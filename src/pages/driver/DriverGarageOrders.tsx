import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import CallButton from "@/components/CallButton";
import ChatPanel from "@/components/ChatPanel";

const ORDER_STEPS = ["pending", "confirmed", "in_progress", "completed"];

const DriverGarageOrders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [garageOwners, setGarageOwners] = useState<Record<string, any>>({});

  const fetchOrders = async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("garage_orders")
      .select("*, garages(name,address,phone,owner_id)")
      .eq("driver_id", user.id)
      .order("created_at", { ascending: false });

    const rows = data || [];
    setOrders(rows);

    const ownerIds = [...new Set(rows.map((o: any) => o.garages?.owner_id).filter(Boolean))];
    if (ownerIds.length) {
      const { data: profiles } = await supabase.from("profiles").select("id,full_name,phone").in("id", ownerIds);
      const map: Record<string, any> = {};
      (profiles || []).forEach((p: any) => { map[p.id] = p; });
      setGarageOwners(map);
    }
  };

  useEffect(() => { fetchOrders(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`garage-orders-driver-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "garage_orders", filter: `driver_id=eq.${user.id}` }, () => fetchOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const stepIndex = (status: string) => Math.max(0, ORDER_STEPS.indexOf(status));

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">My Garage Orders (Realtime)</h2>
      {orders.length === 0 ? (
        <Card><CardContent className="p-6 text-muted-foreground text-center">No garage orders yet</CardContent></Card>
      ) : orders.map((o) => {
        const owner = garageOwners[o.garages?.owner_id];
        return (
          <Card key={o.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between"><p className="font-semibold">{o.garages?.name || "Garage"}</p><Badge>{o.status}</Badge></div>
              <p className="text-sm text-muted-foreground">{o.driver_address || o.garages?.address}</p>
              <p className="text-xs text-muted-foreground">Garage contact: {owner?.full_name || "Garage Owner"} • {owner?.phone || o.garages?.phone || "No phone"}</p>
              {o.mechanic_lat && o.mechanic_lng && (
                <a className="text-xs text-primary underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${o.mechanic_lat},${o.mechanic_lng}`}>
                  View mechanic live location
                </a>
              )}
              {o.driver_lat && o.driver_lng && (
                <a className="text-xs text-primary underline block" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${o.driver_lat},${o.driver_lng}`}>
                  Open my pinned location
                </a>
              )}
              <div className="grid grid-cols-4 gap-1">{ORDER_STEPS.map((s, i) => <div key={s} className={`h-1.5 rounded-full ${i <= stepIndex(o.status) ? "bg-primary" : "bg-muted"}`} />)}</div>
              <p className="text-xs text-muted-foreground capitalize">{String(o.status || "").replaceAll("_", " ")}</p>
              <p className="text-sm">Total: Rs {o.total_amount}</p>
              <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p>
              <div className="flex gap-2 flex-wrap">
                <CallButton phone={owner?.phone || o.garages?.phone} />
                <ChatPanel
                  orderId={o.id}
                  orderType="garage_order"
                  displayNames={{
                    [o.driver_id]: "Driver",
                    [o.garages?.owner_id]: owner?.full_name || "Garage",
                  }}
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default DriverGarageOrders;
