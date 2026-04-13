import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, UtensilsCrossed, DollarSign, CreditCard, Star, TrendingUp, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import StatsCard from "@/components/dashboard/StatsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  preparing: "bg-orange-100 text-orange-800",
  ready: "bg-green-100 text-green-800",
  picked_up: "bg-purple-100 text-purple-800",
  delivered: "bg-green-200 text-green-900",
  cancelled: "bg-red-100 text-red-800",
};

const RestaurantDashboard = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [stats, setStats] = useState({
    ordersToday: 0,
    menuItems: 0,
    revenue: 0,
    subStatus: "Inactive",
    subPlan: "",
    avgRating: 0,
    totalReviews: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const loadStats = async () => {
      const { data: rest } = await supabase.from("restaurants").select("*").eq("owner_id", user.id).maybeSingle();
      if (!rest) return;
      setRestaurant(rest);

      const today = new Date().toISOString().split("T")[0];
      const [orders, items, sub, ratings, recent] = await Promise.all([
        supabase.from("food_orders").select("total_amount").eq("restaurant_id", rest.id).gte("created_at", today),
        supabase.from("menu_items").select("id", { count: "exact", head: true }).eq("restaurant_id", rest.id),
        supabase.from("subscriptions").select("*, subscription_plans(name)").eq("user_id", user.id).eq("status", "active").maybeSingle(),
        supabase.from("ratings").select("rating").eq("restaurant_id", rest.id),
        supabase.from("food_orders").select("*").eq("restaurant_id", rest.id).order("created_at", { ascending: false }).limit(5),
      ]);

      const orderData = orders.data || [];
      const ratingsData = ratings.data || [];
      const avgRating = ratingsData.length > 0
        ? ratingsData.reduce((s, r) => s + r.rating, 0) / ratingsData.length
        : 0;

      setStats({
        ordersToday: orderData.length,
        menuItems: items.count || 0,
        revenue: orderData.reduce((s, o) => s + (Number(o.total_amount) || 0), 0),
        subStatus: sub.data ? "Active" : "Inactive",
        subPlan: (sub.data as any)?.subscription_plans?.name || "",
        avgRating: Math.round(avgRating * 10) / 10,
        totalReviews: ratingsData.length,
      });
      setRecentOrders(recent.data || []);
    };
    loadStats();
  }, [user]);

  const toggleOpen = async () => {
    if (!restaurant) return;
    await supabase.from("restaurants").update({ is_open: !restaurant.is_open }).eq("id", restaurant.id);
    setRestaurant((r: any) => ({ ...r, is_open: !r.is_open }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Welcome, {profile?.full_name || "Partner"}! 👋
          </h2>
          <p className="text-muted-foreground">Here's your restaurant overview</p>
        </div>
        {restaurant && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{restaurant.is_open ? "Open" : "Closed"}</span>
            <Switch checked={restaurant?.is_open} onCheckedChange={toggleOpen} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard title="Orders Today" value={stats.ordersToday} icon={ClipboardList} description="Active orders" />
        <StatsCard title="Revenue Today" value={`Rs ${stats.revenue}`} icon={DollarSign} description="Total sales" />
        <StatsCard title="Menu Items" value={stats.menuItems} icon={UtensilsCrossed} description="Listed items" />
        <StatsCard title="Avg Rating" value={stats.avgRating || "N/A"} icon={Star} description={`${stats.totalReviews} reviews`} />
        <StatsCard
          title="Subscription"
          value={stats.subStatus}
          icon={CreditCard}
          description={stats.subPlan || "No active plan"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Recent Orders</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/restaurant/orders")}>
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">No orders yet</p>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((o) => {
                  const items = Array.isArray(o.items) ? o.items : [];
                  return (
                    <div key={o.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-foreground">#{o.id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">{items.length} item(s) · Rs {o.total_amount}</p>
                      </div>
                      <Badge className={statusColors[o.status] || ""}>{o.status}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/restaurant/menu")}>
              <UtensilsCrossed className="h-4 w-4 mr-2" /> Manage Menu
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/restaurant/orders")}>
              <ClipboardList className="h-4 w-4 mr-2" /> View Orders
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/restaurant/analytics")}>
              <TrendingUp className="h-4 w-4 mr-2" /> Sales Analytics
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/restaurant/reviews")}>
              <Star className="h-4 w-4 mr-2" /> Reviews
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RestaurantDashboard;
