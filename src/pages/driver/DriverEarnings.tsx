import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Car, Truck, TrendingUp, UtensilsCrossed } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { startOfDay, startOfWeek, startOfMonth, subDays, format } from "date-fns";
import StatsCard from "@/components/dashboard/StatsCard";

const DriverEarnings = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState("today");
  const [stats, setStats] = useState({ rides: 0, deliveries: 0, foodDeliveries: 0, rideEarnings: 0, deliveryEarnings: 0, foodEarnings: 0 });
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const getStartDate = () => {
      switch (period) {
        case "today": return startOfDay(new Date()).toISOString();
        case "week": return startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
        case "month": return startOfMonth(new Date()).toISOString();
        default: return null;
      }
    };

    const fetchEarnings = async () => {
      const start = getStartDate();
      let ridesQuery = supabase.from("rides").select("fare, completed_at").eq("driver_id", user.id).eq("status", "completed");
      let parcelsQuery = supabase.from("parcels").select("fare, delivered_at").eq("driver_id", user.id).eq("status", "delivered");
      let foodQuery = supabase.from("food_orders").select("delivery_fee, delivered_at").eq("driver_id", user.id).eq("status", "delivered");
      if (start) {
        ridesQuery = ridesQuery.gte("completed_at", start);
        parcelsQuery = parcelsQuery.gte("delivered_at", start);
        foodQuery = foodQuery.gte("delivered_at", start);
      }
      const [ridesRes, parcelsRes, foodRes] = await Promise.all([ridesQuery, parcelsQuery, foodQuery]);
      const rides = ridesRes.data || [];
      const deliveries = parcelsRes.data || [];
      const foodDeliveries = foodRes.data || [];
      setStats({
        rides: rides.length,
        deliveries: deliveries.length,
        foodDeliveries: foodDeliveries.length,
        rideEarnings: rides.reduce((s, r) => s + (Number(r.fare) || 0), 0),
        deliveryEarnings: deliveries.reduce((s, p) => s + (Number(p.fare) || 0), 0),
        foodEarnings: foodDeliveries.reduce((s, f) => s + (Number(f.delivery_fee) || 0), 0),
      });
      setLoading(false);
    };

    const fetchChart = async () => {
      const days = 7;
      const data: any[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const dayStart = startOfDay(subDays(new Date(), i)).toISOString();
        const dayEnd = startOfDay(subDays(new Date(), i - 1)).toISOString();
        const [r, p, f] = await Promise.all([
          supabase.from("rides").select("fare").eq("driver_id", user.id).eq("status", "completed").gte("completed_at", dayStart).lt("completed_at", dayEnd),
          supabase.from("parcels").select("fare").eq("driver_id", user.id).eq("status", "delivered").gte("delivered_at", dayStart).lt("delivered_at", dayEnd),
          supabase.from("food_orders").select("delivery_fee").eq("driver_id", user.id).eq("status", "delivered").gte("delivered_at", dayStart).lt("delivered_at", dayEnd),
        ]);
        data.push({
          day: format(subDays(new Date(), i), "EEE"),
          rides: (r.data || []).reduce((s, x) => s + (Number(x.fare) || 0), 0),
          parcels: (p.data || []).reduce((s, x) => s + (Number(x.fare) || 0), 0),
          food: (f.data || []).reduce((s, x) => s + (Number(x.delivery_fee) || 0), 0),
        });
      }
      setChartData(data);
    };

    fetchEarnings();
    fetchChart();
  }, [user, period]);

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  const total = stats.rideEarnings + stats.deliveryEarnings + stats.foodEarnings;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Earnings</h2>

      <Card className="border-primary">
        <CardContent className="p-6 text-center">
          <p className="text-sm text-muted-foreground">Total Earnings ({period === "all" ? "All Time" : period === "today" ? "Today" : period === "week" ? "This Week" : "This Month"})</p>
          <p className="text-4xl font-bold text-primary mt-1">Rs {total}</p>
        </CardContent>
      </Card>

      <Tabs value={period} onValueChange={setPeriod}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="week">This Week</TabsTrigger>
          <TabsTrigger value="month">This Month</TabsTrigger>
          <TabsTrigger value="all">All Time</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatsCard title="Rides Completed" value={`${stats.rides} • Rs ${stats.rideEarnings}`} icon={Car} />
        <StatsCard title="Parcel Deliveries" value={`${stats.deliveries} • Rs ${stats.deliveryEarnings}`} icon={Truck} />
        <StatsCard title="Food Deliveries" value={`${stats.foodDeliveries} • Rs ${stats.foodEarnings}`} icon={UtensilsCrossed} />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Last 7 Days
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Legend />
                <Bar dataKey="rides" name="Rides" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="parcels" name="Parcels" fill="hsl(var(--primary) / 0.5)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="food" name="Food" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DriverEarnings;
