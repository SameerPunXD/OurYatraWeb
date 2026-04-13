import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import CallButton from "@/components/CallButton";
import ChatPanel from "@/components/ChatPanel";
import { buildGoogleStaticMapUrl } from "@/lib/googleMaps";

const ORDER_STEPS = ["pending", "confirmed", "in_progress", "completed"];

const mapPreviewUrl = (driverLng?: number, driverLat?: number, mechLng?: number, mechLat?: number) => {
  if (driverLng == null || driverLat == null) return "";
  return buildGoogleStaticMapUrl(
    { lat: driverLat, lng: driverLng },
    mechLng != null && mechLat != null ? { lat: mechLat, lng: mechLng } : null,
  );
};

const GarageOrders = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<Record<string, any>>({});

  const fetchOrders = async () => {
    if (!user) return;
    const { data: garage } = await (supabase as any).from("garages").select("id").eq("owner_id", user.id).maybeSingle();
    if (!garage?.id) return;
    const { data } = await (supabase as any).from("garage_orders").select("*").eq("garage_id", garage.id).order("created_at", { ascending: false });
    const rows = data || [];
    setOrders(rows);

    const driverIds = [...new Set(rows.map((o: any) => o.driver_id).filter(Boolean))];
    if (driverIds.length) {
      const { data: profiles } = await supabase.from("profiles").select("id,full_name,phone").in("id", driverIds);
      const map: Record<string, any> = {};
      (profiles || []).forEach((p: any) => { map[p.id] = p; });
      setDrivers(map);
    }
  };

  useEffect(() => { fetchOrders(); }, [user]);

  useEffect(() => {
    if (!user) return;
    let channel: any;
    (async () => {
      const { data: garage } = await (supabase as any).from("garages").select("id").eq("owner_id", user.id).maybeSingle();
      if (!garage?.id) return;
      channel = supabase
        .channel(`garage-orders-${garage.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "garage_orders", filter: `garage_id=eq.${garage.id}` }, () => fetchOrders())
        .subscribe();
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [user]);

  const updateStatus = async (id: string, currentStatus: string, nextStatus: string) => {
    const allowed: Record<string, string[]> = {
      pending: ["confirmed"],
      confirmed: ["in_progress"],
      in_progress: ["completed"],
      completed: [],
    };
    if (!allowed[currentStatus]?.includes(nextStatus)) {
      toast({ title: "Invalid action", description: `Order already in '${currentStatus.replaceAll("_", " ")}' state.` });
      return;
    }

    await (supabase as any)
      .from("garage_orders")
      .update({ status: nextStatus, mechanic_id: user?.id })
      .eq("id", id)
      .eq("status", currentStatus);
    fetchOrders();
  };

  const shareMyLocation = (id: string) => {
    if (!navigator.geolocation) return toast({ title: "Not supported", variant: "destructive" });
    const order = orders.find((x) => x.id === id);
    if (!order || order.status !== "confirmed") {
      return toast({ title: "Invalid action", description: "You can start live tracking only after confirmation." });
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
      await (supabase as any).from("garage_orders").update({
        mechanic_id: user?.id,
        mechanic_lat: pos.coords.latitude,
        mechanic_lng: pos.coords.longitude,
        mechanic_updated_at: new Date().toISOString(),
        status: "in_progress",
      }).eq("id", id).eq("status", "confirmed");
      toast({ title: "Live location shared" });
      fetchOrders();
    }, () => toast({ title: "Location failed", description: "Allow location permission", variant: "destructive" }));
  };

  const stepIndex = (status: string) => Math.max(0, ORDER_STEPS.indexOf(status));

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Garage Orders (Realtime)</h2>
      {orders.map((o) => {
        const driver = drivers[o.driver_id];
        const previewUrl = mapPreviewUrl(o.driver_lng, o.driver_lat, o.mechanic_lng, o.mechanic_lat);
        return (
          <Card key={o.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between"><p className="font-semibold">Order #{o.id.slice(0, 8)}</p><Badge>{o.status}</Badge></div>
              <p className="text-sm">Driver location: {o.driver_address || "Not provided"}</p>
              <p className="text-xs text-muted-foreground">Driver: {driver?.full_name || "Unknown"} • {driver?.phone || "No phone"}</p>
              {o.location_accuracy === "approximate" && <p className="text-xs text-amber-700">Approximate location used (address-based)</p>}
              {o.status !== "completed" && o.driver_lat && o.driver_lng && previewUrl && (
                <>
                  <img src={previewUrl} alt="Order map" className="w-full rounded-md border" />
                  <a className="text-xs text-primary underline block" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${o.driver_lat},${o.driver_lng}`}>
                    Navigate to driver
                  </a>
                </>
              )}
              {o.mechanic_updated_at && <p className="text-xs text-muted-foreground">Mechanic live update: {new Date(o.mechanic_updated_at).toLocaleTimeString()}</p>}
              <div className="grid grid-cols-4 gap-1">{ORDER_STEPS.map((s, i) => <div key={s} className={`h-1.5 rounded-full ${i <= stepIndex(o.status) ? "bg-primary" : "bg-muted"}`} />)}</div>
              <p className="text-sm">Total: Rs {o.total_amount}</p>
              <div className="rounded-md border p-3 bg-muted/30 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Order Actions</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={o.status === "pending" ? "default" : "outline"}
                    disabled={o.status !== "pending"}
                    onClick={() => updateStatus(o.id, o.status, "confirmed")}
                  >
                    Confirm
                  </Button>

                  <Button
                    size="sm"
                    variant={o.status === "confirmed" ? "default" : "outline"}
                    disabled={o.status !== "confirmed"}
                    onClick={() => shareMyLocation(o.id)}
                  >
                    Start & Share Live Location
                  </Button>

                  <Button
                    size="sm"
                    variant={o.status === "in_progress" ? "default" : "outline"}
                    disabled={o.status !== "in_progress"}
                    onClick={() => updateStatus(o.id, o.status, "completed")}
                  >
                    Complete
                  </Button>

                  <CallButton phone={driver?.phone} />
                  <ChatPanel
                  orderId={o.id}
                  orderType="garage_order"
                  displayNames={{
                    [o.driver_id]: driver?.full_name || "Driver",
                    [user?.id || ""]: "Garage",
                  }}
                />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
      {orders.length === 0 && <Card><CardContent className="p-6 text-center text-muted-foreground">No orders yet</CardContent></Card>}
    </div>
  );
};

export default GarageOrders;
