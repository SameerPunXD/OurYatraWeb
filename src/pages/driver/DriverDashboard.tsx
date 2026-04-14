import { useEffect, useState, useCallback } from "react";
import { Car, Truck, DollarSign, CreditCard, Star, Wifi, WifiOff, MapPin, UtensilsCrossed } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import StatsCard from "@/components/dashboard/StatsCard";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { startOfDay } from "date-fns";
import RatingDisplay from "@/components/RatingDisplay";
import type { Database } from "@/integrations/supabase/types";

type RideStatus = Database["public"]["Enums"]["ride_status"];
type ParcelStatus = Database["public"]["Enums"]["parcel_status"];

const DriverDashboard = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(false);
  const [serviceMode, setServiceMode] = useState("all");
  const [loading, setLoading] = useState(true);
  const [presenceDebug, setPresenceDebug] = useState<{ h3_r9: string | null; last_seen_at: string | null } | null>(null);
  const [stats, setStats] = useState({
    todayEarnings: 0,
    totalRides: 0,
    totalDeliveries: 0,
    totalFoodDeliveries: 0,
    subStatus: "Inactive",
  });
  const [pendingRides, setPendingRides] = useState<any[]>([]);
  const [pendingParcels, setPendingParcels] = useState<any[]>([]);
  const [pendingFoodOrders, setPendingFoodOrders] = useState<any[]>([]);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [activeParcel, setActiveParcel] = useState<any>(null);
  const [activeFoodOrder, setActiveFoodOrder] = useState<any>(null);

  const fetchDriverProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("driver_profiles")
      .select("is_online, service_mode, h3_r9, last_seen_at")
      .eq("id", user.id)
      .maybeSingle();
    if (data) {
      setIsOnline(data.is_online ?? false);
      setServiceMode(data.service_mode ?? "all");
      setPresenceDebug({
        h3_r9: (data as any).h3_r9 ?? null,
        last_seen_at: (data as any).last_seen_at ?? null,
      });
    }
  }, [user]);

  const fetchStats = useCallback(async () => {
    if (!user) return;
    const todayStart = startOfDay(new Date()).toISOString();
    const [rides, parcels, foodDeliveries, todayRides, todayParcels, todayFood, sub] = await Promise.all([
      supabase.from("rides").select("id").eq("driver_id", user.id).eq("status", "completed"),
      supabase.from("parcels").select("id").eq("driver_id", user.id).eq("status", "delivered"),
      supabase.from("food_orders").select("id").eq("driver_id", user.id).eq("status", "delivered"),
      supabase.from("rides").select("fare").eq("driver_id", user.id).eq("status", "completed").gte("completed_at", todayStart),
      supabase.from("parcels").select("fare").eq("driver_id", user.id).eq("status", "delivered").gte("delivered_at", todayStart),
      supabase.from("food_orders").select("delivery_fee").eq("driver_id", user.id).eq("status", "delivered").gte("delivered_at", todayStart),
      supabase.from("subscriptions").select("id").eq("user_id", user.id).eq("status", "active").maybeSingle(),
    ]);
    const todayRideEarnings = (todayRides.data || []).reduce((s, r) => s + (Number(r.fare) || 0), 0);
    const todayParcelEarnings = (todayParcels.data || []).reduce((s, p) => s + (Number(p.fare) || 0), 0);
    const todayFoodEarnings = (todayFood.data || []).reduce((s, f) => s + (Number(f.delivery_fee) || 0), 0);
    setStats({
      todayEarnings: todayRideEarnings + todayParcelEarnings + todayFoodEarnings,
      totalRides: (rides.data || []).length,
      totalDeliveries: (parcels.data || []).length,
      totalFoodDeliveries: (foodDeliveries.data || []).length,
      subStatus: sub.data ? "Active" : "Inactive",
    });
  }, [user]);

  const fetchIncoming = useCallback(async () => {
    if (!user) return;
    const [pr, pp, pf, ar, ap, af] = await Promise.all([
      supabase.from("rides").select("*").eq("status", "pending").order("created_at", { ascending: false }).limit(10),
      supabase.from("parcels").select("*").eq("status", "pending").order("created_at", { ascending: false }).limit(10),
      supabase.from("food_orders").select("*, restaurants(name, address)").eq("status", "ready").is("driver_id", null).order("created_at", { ascending: false }).limit(10),
      supabase.from("rides").select("*").eq("driver_id", user.id).in("status", ["accepted", "in_progress"]).maybeSingle(),
      supabase.from("parcels").select("*").eq("driver_id", user.id).in("status", ["driver_assigned", "driver_arriving", "picked_up", "in_transit", "arrived_destination", "otp_verified"]).maybeSingle(),
      supabase.from("food_orders").select("*, restaurants(name, address)").eq("driver_id", user.id).in("status", ["picked_up", "on_the_way"]).maybeSingle(),
    ]);
    setPendingRides(pr.data || []);
    setPendingParcels(pp.data || []);
    setPendingFoodOrders(pf.data || []);
    setActiveRide(ar.data || null);
    setActiveParcel(ap.data || null);
    setActiveFoodOrder(af.data || null);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    Promise.all([fetchDriverProfile(), fetchStats(), fetchIncoming()]).then(() => setLoading(false));
  }, [user, fetchDriverProfile, fetchStats, fetchIncoming]);

  useEffect(() => {
    if (!user) return;

    const ch = supabase
      .channel(`driver-overview-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, () => { fetchIncoming(); fetchStats(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_driver_candidates", filter: `driver_id=eq.${user.id}` }, () => { fetchIncoming(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "parcels" }, () => { fetchIncoming(); fetchStats(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "food_orders" }, () => { fetchIncoming(); fetchStats(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchIncoming, fetchStats, user]);

  const toggleOnline = async (val: boolean) => {
    if (!user) return;
    const previousIsOnline = isOnline;
    setIsOnline(val);

    if (!val) {
      const { error: removeError } = await (supabase as any).rpc("remove_driver_from_pending_rides");
      if (removeError) {
        setIsOnline(previousIsOnline);
        toast({ title: "Failed to update status", description: removeError.message, variant: "destructive" });
        return;
      }
    }

    const { error } = await supabase
      .from("driver_profiles")
      .upsert({ id: user.id, is_online: val, service_mode: serviceMode }, { onConflict: "id" });
    if (error) {
      setIsOnline(previousIsOnline);
      toast({ title: "Failed to update status", variant: "destructive" });
      return;
    }
    window.dispatchEvent(new Event("driver-profile-changed"));
    fetchDriverProfile();
  };

  const changeServiceMode = async (mode: string) => {
    if (!user) return;
    const previousMode = serviceMode;
    setServiceMode(mode);
    const { error } = await supabase
      .from("driver_profiles")
      .upsert({ id: user.id, is_online: isOnline, service_mode: mode }, { onConflict: "id" });
    if (error) {
      setServiceMode(previousMode);
      toast({ title: "Failed to update mode", variant: "destructive" });
      return;
    }
    window.dispatchEvent(new Event("driver-profile-changed"));
    fetchDriverProfile();
  };

  const acceptRide = async (id: string) => {
    if (!user) return;
    const ride = pendingRides.find(r => r.id === id);
    const { error } = await (supabase as any).rpc("claim_ride", { p_ride_id: id });
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Ride accepted!" });
      if (ride?.rider_id) {
        supabase.rpc("notify_user", { _user_id: ride.rider_id, _title: "Driver Found!", _message: "A driver has accepted your ride.", _type: "ride" });
      }
      fetchIncoming();
    }
  };

  const acceptParcel = async (id: string) => {
    if (!user) return;
    const parcel = pendingParcels.find(p => p.id === id);
    const { error } = await supabase.from("parcels").update({ driver_id: user.id, status: "driver_assigned" as any }).eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Parcel accepted!" });
      if (parcel?.sender_id) {
        supabase.rpc("notify_user", { _user_id: parcel.sender_id, _title: "Driver Assigned", _message: "A driver has accepted your parcel delivery.", _type: "parcel" });
      }
      fetchIncoming();
    }
  };

  const acceptFoodOrder = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("food_orders").update({ driver_id: user.id, status: "picked_up" as any }).eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Food order accepted! Head to restaurant." }); fetchIncoming(); }
  };

  const updateRideStatus = async (id: string, status: RideStatus) => {
    const updates: Record<string, any> = { status };
    if (status === "in_progress") updates.started_at = new Date().toISOString();
    if (status === "completed") updates.completed_at = new Date().toISOString();
    await supabase.from("rides").update(updates).eq("id", id);
    fetchIncoming(); fetchStats();
  };

  const updateParcelStatus = async (id: string, status: ParcelStatus) => {
    const updates: Record<string, any> = { status };
    if (status === "delivered") updates.delivered_at = new Date().toISOString();
    await supabase.from("parcels").update(updates).eq("id", id);
    fetchIncoming(); fetchStats();
  };

  const updateFoodOrderStatus = async (id: string, status: string) => {
    const updates: Record<string, any> = { status };
    if (status === "delivered") updates.delivered_at = new Date().toISOString();
    await supabase.from("food_orders").update(updates).eq("id", id);
    fetchIncoming(); fetchStats();
  };

  const showRides = serviceMode === "ride" || serviceMode === "all";
  const showParcels = serviceMode === "parcel" || serviceMode === "all";
  const showFood = serviceMode === "food" || serviceMode === "all";

  if (loading) return <p className="text-muted-foreground p-4">Loading dashboard...</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Welcome, {profile?.full_name || "Driver"}! 👋</h2>
          <p className="text-muted-foreground">Manage your rides, deliveries & food orders</p>
        </div>
        <Card className={isOnline ? "border-green-500 bg-green-50 dark:bg-green-950/20" : "border-muted"}>
          <CardContent className="p-4 flex items-center gap-3">
            {isOnline ? <Wifi className="h-5 w-5 text-green-600" /> : <WifiOff className="h-5 w-5 text-muted-foreground" />}
            <div>
              <p className="text-sm font-medium">{isOnline ? "Online" : "Offline"}</p>
              <p className="text-xs text-muted-foreground">{isOnline ? "Accepting requests" : "Not accepting"}</p>
              {import.meta.env.DEV && presenceDebug?.h3_r9 && (
                <p className="text-[11px] text-muted-foreground">
                  H3: <span className="font-mono">{presenceDebug.h3_r9}</span>
                </p>
              )}
            </div>
            <Switch checked={isOnline} onCheckedChange={toggleOnline} />
          </CardContent>
        </Card>
      </div>

      {/* Service mode */}
      <Card>
        <CardContent className="p-4">
          <Label className="text-sm font-medium mb-3 block">Service Mode</Label>
          <RadioGroup value={serviceMode} onValueChange={changeServiceMode} className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="ride" id="mode-ride" />
              <Label htmlFor="mode-ride" className="flex items-center gap-1 cursor-pointer"><Car className="h-4 w-4" /> Ride</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="parcel" id="mode-parcel" />
              <Label htmlFor="mode-parcel" className="flex items-center gap-1 cursor-pointer"><Truck className="h-4 w-4" /> Parcel</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="food" id="mode-food" />
              <Label htmlFor="mode-food" className="flex items-center gap-1 cursor-pointer"><UtensilsCrossed className="h-4 w-4" /> Food</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="all" id="mode-all" />
              <Label htmlFor="mode-all" className="cursor-pointer">All</Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <StatsCard title="Today's Earnings" value={`Rs ${stats.todayEarnings}`} icon={DollarSign} description="Today" />
        <StatsCard title="Total Rides" value={stats.totalRides} icon={Car} description="All time" />
        <StatsCard title="Parcel Deliveries" value={stats.totalDeliveries} icon={Truck} description="All time" />
        <StatsCard title="Food Deliveries" value={stats.totalFoodDeliveries} icon={UtensilsCrossed} description="All time" />
        <StatsCard title="Subscription" value={stats.subStatus} icon={CreditCard} description={stats.subStatus === "Active" ? "Plan active" : "No plan"} />
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rating</p>
                <div className="mt-1"><RatingDisplay userId={user?.id} compact /></div>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Star className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Jobs */}
      {(activeRide || activeParcel || activeFoodOrder) && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground">Active Jobs</h3>
          {activeRide && (
            <Card className="border-primary">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2"><Car className="h-4 w-4 text-primary" /><span className="font-medium">Ride</span></div>
                  <Badge variant="secondary">{activeRide.status}</Badge>
                </div>
                <p className="text-sm"><MapPin className="h-3 w-3 inline mr-1" />{activeRide.pickup_location} → {activeRide.dropoff_location}</p>
                <p className="text-sm text-muted-foreground mt-1">Fare: Rs {activeRide.fare}</p>
                <div className="flex gap-2 mt-3">
                  {activeRide.status === "accepted" && <Button size="sm" onClick={() => updateRideStatus(activeRide.id, "in_progress")}>Start Trip</Button>}
                  {activeRide.status === "in_progress" && <Button size="sm" onClick={() => updateRideStatus(activeRide.id, "completed")}>Complete Trip</Button>}
                </div>
              </CardContent>
            </Card>
          )}
          {activeParcel && (
            <Card className="border-primary">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /><span className="font-medium">Parcel</span></div>
                  <Badge variant="secondary">{activeParcel.status}</Badge>
                </div>
                <p className="text-sm"><MapPin className="h-3 w-3 inline mr-1" />{activeParcel.pickup_location} → {activeParcel.dropoff_location}</p>
                <p className="text-sm text-muted-foreground mt-1">To: {activeParcel.recipient_name} • Rs {activeParcel.fare}</p>
                <div className="flex gap-2 mt-3">
                  {activeParcel.status === "picked_up" && <Button size="sm" onClick={() => updateParcelStatus(activeParcel.id, "in_transit")}>Mark In Transit</Button>}
                  {activeParcel.status === "in_transit" && <Button size="sm" onClick={() => updateParcelStatus(activeParcel.id, "delivered")}>Mark Delivered</Button>}
                </div>
              </CardContent>
            </Card>
          )}
          {activeFoodOrder && (
            <Card className="border-primary">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2"><UtensilsCrossed className="h-4 w-4 text-primary" /><span className="font-medium">Food Delivery</span></div>
                  <Badge variant="secondary">{activeFoodOrder.status?.replace("_", " ")}</Badge>
                </div>
                <p className="text-sm font-medium">{activeFoodOrder.restaurants?.name}</p>
                <p className="text-sm"><MapPin className="h-3 w-3 inline mr-1" />{activeFoodOrder.restaurants?.address} → {activeFoodOrder.delivery_address}</p>
                <p className="text-sm text-muted-foreground mt-1">Fee: Rs {activeFoodOrder.delivery_fee || 0}</p>
                <div className="flex gap-2 mt-3">
                  {activeFoodOrder.status === "picked_up" && <Button size="sm" onClick={() => updateFoodOrderStatus(activeFoodOrder.id, "on_the_way")}>On the Way</Button>}
                  {activeFoodOrder.status === "on_the_way" && <Button size="sm" onClick={() => updateFoodOrderStatus(activeFoodOrder.id, "delivered")}>Mark Delivered</Button>}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Incoming Requests */}
      {isOnline && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground">Incoming Requests</h3>
          {(showRides ? pendingRides : []).length === 0 && (showParcels ? pendingParcels : []).length === 0 && (showFood ? pendingFoodOrders : []).length === 0 ? (
            <Card><CardContent className="p-8 text-center"><p className="text-muted-foreground">No incoming requests right now</p></CardContent></Card>
          ) : (
            <div className="space-y-2">
              {showRides && pendingRides.map((r) => (
                <Card key={r.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center"><Car className="h-4 w-4 text-blue-600" /></div>
                      <div>
                        <p className="font-medium text-sm">{r.pickup_location} → {r.dropoff_location}</p>
                        <p className="text-xs text-muted-foreground">Rs {r.fare} • {r.vehicle_type}</p>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => acceptRide(r.id)}>Accept</Button>
                  </CardContent>
                </Card>
              ))}
              {showParcels && pendingParcels.map((p) => (
                <Card key={p.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center"><Truck className="h-4 w-4 text-orange-600" /></div>
                      <div>
                        <p className="font-medium text-sm">{p.pickup_location} → {p.dropoff_location}</p>
                        <p className="text-xs text-muted-foreground">Rs {p.fare} • {p.recipient_name}</p>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => acceptParcel(p.id)}>Accept</Button>
                  </CardContent>
                </Card>
              ))}
              {showFood && pendingFoodOrders.map((f: any) => (
                <Card key={f.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center"><UtensilsCrossed className="h-4 w-4 text-accent-foreground" /></div>
                      <div>
                        <p className="font-medium text-sm">{f.restaurants?.name || "Restaurant"}</p>
                        <p className="text-xs text-muted-foreground">Rs {f.delivery_fee || 0} fee → {f.delivery_address}</p>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => acceptFoodOrder(f.id)}>Accept</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {!isOnline && (
        <Card>
          <CardContent className="p-8 text-center">
            <WifiOff className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Go online to start receiving requests</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DriverDashboard;
