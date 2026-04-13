import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Car, Package, UtensilsCrossed, CreditCard, Clock, MapPin, ArrowRight, Zap, Bus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  accepted: "bg-blue-100 text-blue-800",
  in_progress: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  confirmed: "bg-blue-100 text-blue-800",
  preparing: "bg-orange-100 text-orange-800",
  ready: "bg-green-100 text-green-800",
  picked_up: "bg-purple-100 text-purple-800",
  delivered: "bg-green-200 text-green-900",
  in_transit: "bg-blue-100 text-blue-800",
};

interface HistoryItem {
  id: string;
  type: "ride" | "parcel" | "food";
  title: string;
  subtitle: string;
  status: string;
  amount: number | null;
  date: string;
}

const RiderDashboard = () => {
  const { user, profile } = useAuth();
  const [activeRides, setActiveRides] = useState<any[]>([]);
  const [activeParcels, setActiveParcels] = useState<any[]>([]);
  const [activeFoodOrders, setActiveFoodOrders] = useState<any[]>([]);
  const [recentHistory, setRecentHistory] = useState<HistoryItem[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<any[]>([]);
  const [subStatus, setSubStatus] = useState<{ active: boolean; planName?: string; endsAt?: string }>({ active: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchAll = async () => {
      const [ridesRes, parcelsRes, foodRes, addressesRes, subRes] = await Promise.all([
        supabase.from("rides").select("*").eq("rider_id", user.id).in("status", ["pending", "accepted", "in_progress"]).order("created_at", { ascending: false }).limit(5),
        supabase.from("parcels").select("*").eq("sender_id", user.id).in("status", ["pending", "driver_assigned", "driver_arriving", "picked_up", "in_transit", "arrived_destination", "otp_verified"]).order("created_at", { ascending: false }).limit(5),
        supabase.from("food_orders").select("*, restaurants(name)").eq("customer_id", user.id).in("status", ["pending", "confirmed", "preparing", "ready", "picked_up", "on_the_way"]).order("created_at", { ascending: false }).limit(5),
        supabase.from("saved_addresses").select("*").eq("user_id", user.id).order("created_at", { ascending: true }).limit(5),
        supabase.from("subscriptions").select("*, subscription_plans(name)").eq("user_id", user.id).eq("status", "active").maybeSingle(),
      ]);

      setActiveRides(ridesRes.data || []);
      setActiveParcels(parcelsRes.data || []);
      setActiveFoodOrders(foodRes.data || []);
      setSavedPlaces(addressesRes.data || []);

      if (subRes.data) {
        setSubStatus({ active: true, planName: (subRes.data as any).subscription_plans?.name, endsAt: subRes.data.ends_at });
      }

      // Build recent history
      const [histRides, histParcels, histFood] = await Promise.all([
        supabase.from("rides").select("id, pickup_location, dropoff_location, status, fare, created_at").eq("rider_id", user.id).order("created_at", { ascending: false }).limit(3),
        supabase.from("parcels").select("id, pickup_location, dropoff_location, status, fare, created_at").eq("sender_id", user.id).order("created_at", { ascending: false }).limit(3),
        supabase.from("food_orders").select("id, status, total_amount, created_at, restaurants(name)").eq("customer_id", user.id).order("created_at", { ascending: false }).limit(3),
      ]);

      const items: HistoryItem[] = [
        ...(histRides.data || []).map((r: any) => ({ id: r.id, type: "ride" as const, title: `${r.pickup_location} → ${r.dropoff_location}`, subtitle: "Ride", status: r.status, amount: r.fare, date: r.created_at })),
        ...(histParcels.data || []).map((p: any) => ({ id: p.id, type: "parcel" as const, title: `${p.pickup_location} → ${p.dropoff_location}`, subtitle: "Parcel", status: p.status, amount: p.fare, date: p.created_at })),
        ...(histFood.data || []).map((f: any) => ({ id: f.id, type: "food" as const, title: `Order from ${(f as any).restaurants?.name || "Restaurant"}`, subtitle: "Food Order", status: f.status, amount: f.total_amount, date: f.created_at })),
      ];
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRecentHistory(items.slice(0, 5));
      setLoading(false);
    };

    fetchAll();
  }, [user]);

  const quickActions = [
    { title: "Book a Ride", description: "Get picked up now", icon: Car, to: "/rider/book-ride", color: "bg-primary/10 text-primary" },
    { title: "Buses", description: "Book inter-district bus tickets", icon: Bus, to: "/rider/buses", color: "bg-sky-100 text-sky-700" },
    { title: "Send Parcel", description: "Fast & reliable delivery", icon: Package, to: "/rider/send-parcel", color: "bg-orange-100 text-orange-600" },
    { title: "Order Food", description: "From local restaurants", icon: UtensilsCrossed, to: "/rider/food", color: "bg-green-100 text-green-600" },
  ];

  const typeIcons = { ride: Car, parcel: Package, food: UtensilsCrossed };
  const totalActive = activeRides.length + activeParcels.length + activeFoodOrders.length;

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading dashboard...</p></div>;

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">      {/* Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-foreground truncate">Welcome, {profile?.full_name || "User"}! 👋</h2>
          <p className="text-muted-foreground">Here's your activity overview</p>
        </div>
        {subStatus.active && (
          <Badge className="bg-primary/10 text-primary border-primary/20 w-fit">{subStatus.planName || "Active Plan"}</Badge>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 w-full">        {quickActions.map(a => (
          <Link key={a.to} to={a.to}>
            <Card className="w-full max-w-full hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group">
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${a.color}`}>
                  <a.icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{a.title}</p>
                  <p className="text-sm text-muted-foreground">{a.description}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Active Bookings */}
      {totalActive > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" /> Active Bookings ({totalActive})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeRides.map(r => (
              <div key={r.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3 min-w-0">
                  <Car className="h-5 w-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{r.pickup_location} → {r.dropoff_location}</p>
                    <p className="text-xs text-muted-foreground">Ride • Rs {r.fare}</p>
                  </div>
                </div>
                <Badge className={statusColors[r.status] + " shrink-0 w-fit"}>{r.status.replace("_", " ")}</Badge>
              </div>
            ))}
            {activeParcels.map(p => (
              <div key={p.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3 min-w-0">
                  <Package className="h-5 w-5 text-orange-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.pickup_location} → {p.dropoff_location}</p>
                    <p className="text-xs text-muted-foreground">Parcel • Rs {p.fare || "—"}</p>
                  </div>
                </div>
                <Badge className={statusColors[p.status] + " shrink-0 w-fit"}>{p.status.replace("_", " ")}</Badge>
              </div>
            ))}
            {activeFoodOrders.map(o => (
              <div key={o.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3 min-w-0">
                  <UtensilsCrossed className="h-5 w-5 text-green-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{(o as any).restaurants?.name || "Food Order"}</p>
                    <p className="text-xs text-muted-foreground">Rs {o.total_amount}</p>
                  </div>
                </div>
                <Badge className={statusColors[o.status] + " shrink-0 w-fit"}>{o.status.replace("_", " ")}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Subscription Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" /> Subscription
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subStatus.active ? (
              <div>
                <p className="font-semibold text-foreground">{subStatus.planName}</p>
                <p className="text-sm text-muted-foreground">Expires {new Date(subStatus.endsAt!).toLocaleDateString()}</p>
                <Button variant="outline" size="sm" className="mt-3" asChild><Link to="/rider/subscription">Manage</Link></Button>
              </div>
            ) : (
              <div>
                <p className="text-muted-foreground text-sm">No active subscription</p>
                <Button size="sm" className="mt-3" asChild><Link to="/rider/subscription">Subscribe Now</Link></Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Saved Places */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" /> Saved Places
              </CardTitle>
              <Button variant="ghost" size="sm" asChild><Link to="/rider/addresses">Manage</Link></Button>
            </div>
          </CardHeader>
          <CardContent>
            {savedPlaces.length === 0 ? (
              <div>
                <p className="text-sm text-muted-foreground">No saved addresses yet</p>
                <Button variant="outline" size="sm" className="mt-2" asChild><Link to="/rider/addresses">Add Address</Link></Button>
              </div>
            ) : (
              <div className="space-y-2">
                {savedPlaces.slice(0, 3).map(a => (
                  <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{a.label}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">{a.address}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent History */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" /> Recent Activity
            </CardTitle>
            <Button variant="ghost" size="sm" asChild><Link to="/rider/history">View All</Link></Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No activity yet. Book your first ride!</p>
          ) : (
            <div className="space-y-3">
              {recentHistory.map(item => {
                const Icon = typeIcons[item.type];
                return (
                  <div key={item.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg border border-border">
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground break-words sm:truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.subtitle} • {new Date(item.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                      {item.amount && <span className="text-sm font-semibold text-foreground">Rs {item.amount}</span>}
                      <Badge className={statusColors[item.status] || "bg-muted text-foreground"}>{item.status.replace("_", " ")}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RiderDashboard;
