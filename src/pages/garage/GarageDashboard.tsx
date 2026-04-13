import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import StatsCard from "@/components/dashboard/StatsCard";
import { Wrench, ClipboardList, Wallet } from "lucide-react";

const GarageDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ services: 0, pending: 0, revenue: 0 });

  useEffect(() => {
    const run = async () => {
      if (!user) return;
      const { data: garage } = await (supabase as any).from("garages").select("id").eq("owner_id", user.id).maybeSingle();
      if (!garage?.id) return;

      const [servicesRes, ordersRes] = await Promise.all([
        (supabase as any).from("garage_services").select("id", { count: "exact", head: true }).eq("garage_id", garage.id),
        (supabase as any).from("garage_orders").select("status,total_amount").eq("garage_id", garage.id),
      ]);

      const orders = ordersRes.data || [];
      setStats({
        services: servicesRes.count || 0,
        pending: orders.filter((o: any) => o.status === "pending").length,
        revenue: orders.filter((o: any) => o.status === "completed").reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0),
      });
    };
    run();
  }, [user]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Garage Dashboard</h2>
      <div className="grid sm:grid-cols-3 gap-4">
        <StatsCard title="Services" value={stats.services} icon={Wrench} description="Active services" />
        <StatsCard title="Pending Orders" value={stats.pending} icon={ClipboardList} description="Need action" />
        <StatsCard title="Revenue" value={`Rs ${stats.revenue}`} icon={Wallet} description="Completed orders" />
      </div>
    </div>
  );
};

export default GarageDashboard;
