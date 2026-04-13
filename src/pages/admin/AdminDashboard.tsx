import { useEffect, useState } from "react";
import { Users, Car, UtensilsCrossed, ShoppingBag, Package, CreditCard, DollarSign, TrendingUp, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import StatsCard from "@/components/dashboard/StatsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    users: 0, drivers: 0, restaurants: 0, rides: 0,
    parcels: 0, foodOrders: 0, activeSubs: 0, revenue: 0,
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [usersR, driversR, restaurantsR, ridesR, parcelsR, foodR, subsR, plansR, recentRidesR, recentOrdersR] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "driver"),
        supabase.from("restaurants").select("id", { count: "exact", head: true }),
        supabase.from("rides").select("id", { count: "exact", head: true }),
        supabase.from("parcels").select("id", { count: "exact", head: true }),
        supabase.from("food_orders").select("id", { count: "exact", head: true }),
        supabase.from("subscriptions").select("id, plan_id", { count: "exact" }).eq("status", "active"),
        supabase.from("subscription_plans").select("id, price"),
        supabase.from("rides").select("id, pickup_location, dropoff_location, status, created_at, fare").order("created_at", { ascending: false }).limit(5),
        supabase.from("food_orders").select("id, delivery_address, status, created_at, total_amount").order("created_at", { ascending: false }).limit(5),
      ]);

      // Calculate revenue from active subscriptions
      const planMap = Object.fromEntries((plansR.data || []).map(p => [p.id, p.price]));
      const revenue = (subsR.data || []).reduce((sum, s) => sum + (planMap[s.plan_id] || 0), 0);

      setStats({
        users: usersR.count || 0,
        drivers: driversR.count || 0,
        restaurants: restaurantsR.count || 0,
        rides: ridesR.count || 0,
        parcels: parcelsR.count || 0,
        foodOrders: foodR.count || 0,
        activeSubs: subsR.count || 0,
        revenue,
      });

      // Merge recent activity
      const activity = [
        ...(recentRidesR.data || []).map(r => ({ type: "ride", label: `${r.pickup_location} → ${r.dropoff_location}`, status: r.status, date: r.created_at, amount: r.fare })),
        ...(recentOrdersR.data || []).map(o => ({ type: "order", label: o.delivery_address, status: o.status, date: o.created_at, amount: o.total_amount })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);
      setRecentActivity(activity);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <p className="text-muted-foreground p-4">Loading dashboard...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Admin Dashboard</h2>
        <p className="text-muted-foreground">Platform overview and management</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatsCard title="Total Users" value={stats.users} icon={Users} description="All accounts" />
        <StatsCard title="Drivers" value={stats.drivers} icon={Car} description="Registered drivers" />
        <StatsCard title="Restaurants" value={stats.restaurants} icon={UtensilsCrossed} description="Partner restaurants" />
        <StatsCard title="Total Rides" value={stats.rides} icon={TrendingUp} description="All time" />
        <StatsCard title="Parcels" value={stats.parcels} icon={Package} description="All deliveries" />
        <StatsCard title="Food Orders" value={stats.foodOrders} icon={ShoppingBag} description="All orders" />
        <StatsCard title="Active Subs" value={stats.activeSubs} icon={CreditCard} description="Current plans" />
        <StatsCard title="Sub Revenue" value={`Rs ${stats.revenue}`} icon={DollarSign} description="Active monthly" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((a, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className="text-xs shrink-0">{a.type}</Badge>
                    <span className="text-foreground break-words sm:truncate sm:max-w-[260px]">{a.label}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {a.amount && <span className="text-muted-foreground">Rs {a.amount}</span>}
                    <Badge variant="secondary" className="text-xs whitespace-nowrap">{a.status}</Badge>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(a.date).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
