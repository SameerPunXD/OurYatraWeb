import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatsCard from "@/components/dashboard/StatsCard";
import { DollarSign, ShoppingBag, TrendingUp, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "#94a3b8", "#ef4444"];

type Range = "today" | "week" | "month";

const RestaurantAnalytics = () => {
  const { user } = useAuth();
  const [range, setRange] = useState<Range>("week");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data: rest } = await supabase.from("restaurants").select("id").eq("owner_id", user.id).maybeSingle();
      if (!rest) { setLoading(false); return; }

      const now = new Date();
      let from: Date;
      if (range === "today") from = new Date(now.toISOString().split("T")[0]);
      else if (range === "week") { from = new Date(now); from.setDate(from.getDate() - 7); }
      else { from = new Date(now); from.setMonth(from.getMonth() - 1); }

      const { data } = await supabase
        .from("food_orders")
        .select("*")
        .eq("restaurant_id", rest.id)
        .gte("created_at", from.toISOString())
        .order("created_at");
      setOrders(data || []);
      setLoading(false);
    };
    load();
  }, [user, range]);

  const totalRevenue = orders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
  const avgOrder = orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0;

  // Revenue by day
  const revenueByDay = orders.reduce<Record<string, number>>((acc, o) => {
    const day = new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    acc[day] = (acc[day] || 0) + (Number(o.total_amount) || 0);
    return acc;
  }, {});
  const revenueChartData = Object.entries(revenueByDay).map(([day, amount]) => ({ day, amount }));

  // Orders by status
  const statusCounts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});
  const statusChartData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  // Top items
  const itemCounts: Record<string, { name: string; qty: number; revenue: number }> = {};
  orders.forEach((o) => {
    const items = Array.isArray(o.items) ? o.items : [];
    items.forEach((item: any) => {
      const key = item.name || "Unknown";
      if (!itemCounts[key]) itemCounts[key] = { name: key, qty: 0, revenue: 0 };
      itemCounts[key].qty += item.quantity || 1;
      itemCounts[key].revenue += (item.price || 0) * (item.quantity || 1);
    });
  });
  const topItems = Object.values(itemCounts).sort((a, b) => b.qty - a.qty).slice(0, 5);

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Sales Analytics</h2>
        <div className="flex gap-1">
          {(["today", "week", "month"] as Range[]).map((r) => (
            <Button key={r} size="sm" variant={range === r ? "default" : "outline"} onClick={() => setRange(r)}>
              {r === "today" ? "Today" : r === "week" ? "This Week" : "This Month"}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard title="Total Revenue" value={`Rs ${totalRevenue}`} icon={DollarSign} description={`${range}`} />
        <StatsCard title="Total Orders" value={orders.length} icon={ShoppingBag} description={`${range}`} />
        <StatsCard title="Avg Order Value" value={`Rs ${avgOrder}`} icon={TrendingUp} description="Per order" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg">Revenue by Day</CardTitle></CardHeader>
          <CardContent>
            {revenueChartData.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg">Orders by Status</CardTitle></CardHeader>
          <CardContent>
            {statusChartData.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {statusChartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-lg">Top Selling Items</CardTitle></CardHeader>
        <CardContent>
          {topItems.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No data</p>
          ) : (
            <div className="space-y-2">
              {topItems.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-muted-foreground w-6">#{i + 1}</span>
                    <span className="text-sm font-medium text-foreground">{item.name}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {item.qty} sold · Rs {item.revenue}
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

export default RestaurantAnalytics;
