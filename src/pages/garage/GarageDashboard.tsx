import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import StatsCard from "@/components/dashboard/StatsCard";
import { Wrench, ClipboardList, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

const GarageDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ services: 0, active: 0, revenue: 0 });
  const [garage, setGarage] = useState<any>(null);

  useEffect(() => {
    const run = async () => {
      if (!user) return;
      const { data: garageRow } = await (supabase as any)
        .from("garages")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!garageRow?.id) return;
      setGarage(garageRow);

      const [servicesRes, ordersRes] = await Promise.all([
        (supabase as any).from("garage_services").select("id", { count: "exact", head: true }).eq("garage_id", garageRow.id),
        (supabase as any).from("garage_orders").select("status,total_amount").eq("garage_id", garageRow.id),
      ]);

      const orders = ordersRes.data || [];
      setStats({
        services: servicesRes.count || 0,
        active: orders.filter((o: any) => o.status !== "completed").length,
        revenue: orders.filter((o: any) => o.status === "completed").reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0),
      });
    };
    run();
  }, [user]);

  const toggleOpen = async (checked: boolean) => {
    if (!garage?.id) return;
    const { data } = await (supabase as any)
      .from("garages")
      .update({ is_open: checked })
      .eq("id", garage.id)
      .select("*")
      .single();
    setGarage(data || garage);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Garage Dashboard</h2>
      {garage && (
        <Card>
          <CardContent className="flex items-center justify-between gap-4 p-6">
            <div>
              <p className="font-semibold">{garage.name}</p>
              <p className="text-sm text-muted-foreground">{garage.address}</p>
            </div>
            <div className="flex items-center gap-3">
              <p className={`text-xs font-semibold ${garage.is_open ? "text-emerald-600" : "text-muted-foreground"}`}>
                {garage.is_open ? "OPEN" : "CLOSED"}
              </p>
              <Switch checked={!!garage.is_open} onCheckedChange={toggleOpen} />
            </div>
          </CardContent>
        </Card>
      )}
      <div className="grid sm:grid-cols-3 gap-4">
        <StatsCard title="Services" value={stats.services} icon={Wrench} description="Active services" />
        <StatsCard title="Open Orders" value={stats.active} icon={ClipboardList} description="Pending or active work" />
        <StatsCard title="Revenue" value={`Rs ${stats.revenue}`} icon={Wallet} description="Completed orders" />
      </div>
    </div>
  );
};

export default GarageDashboard;
