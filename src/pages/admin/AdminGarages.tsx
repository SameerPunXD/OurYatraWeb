import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const AdminGarages = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);

  const run = async () => {
    const { data: garages } = await (supabase as any).from("garages").select("*").order("created_at", { ascending: false });
    const ownerIds = [...new Set((garages || []).map((g: any) => g.owner_id))];
    const garageIds = (garages || []).map((g: any) => g.id);

    const [profilesRes, ordersRes] = await Promise.all([
      ownerIds.length
        ? supabase.from("profiles").select("id, full_name, account_status").in("id", ownerIds)
        : Promise.resolve({ data: [] as any[] } as any),
      garageIds.length
        ? (supabase as any).from("garage_orders").select("garage_id,status,total_amount").in("garage_id", garageIds)
        : Promise.resolve({ data: [] as any[] } as any),
    ]);

    const profileMap = Object.fromEntries((profilesRes.data || []).map((p: any) => [p.id, p]));
    const orderMap: Record<string, any[]> = {};
    (ordersRes.data || []).forEach((o: any) => {
      orderMap[o.garage_id] = orderMap[o.garage_id] || [];
      orderMap[o.garage_id].push(o);
    });

    setRows((garages || []).map((g: any) => {
      const orders = orderMap[g.id] || [];
      return {
        ...g,
        owner: profileMap[g.owner_id],
        orderCount: orders.length,
        pendingCount: orders.filter((o: any) => o.status !== "completed").length,
        revenue: orders.filter((o: any) => o.status === "completed").reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0),
      };
    }));
  };

  useEffect(() => {
    run();
  }, []);

  const updateOwnerStatus = async (ownerId: string, status: "approved" | "blocked" | "rejected") => {
    const { error } = await supabase.from("profiles").update({ account_status: status } as any).eq("id", ownerId);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }

    await supabase.rpc("notify_user", {
      _user_id: ownerId,
      _title: status === "approved" ? "Garage account approved" : status === "blocked" ? "Garage account blocked" : "Garage account rejected",
      _message: status === "approved" ? "Your garage account is approved. You can now operate." : "Your garage account status was updated by admin.",
      _type: `garage_${status}`,
    });

    toast({ title: `Garage ${status}` });
    run();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Garages ({rows.length})</h2>
      {rows.map((g) => (
        <Card key={g.id}>
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{g.name}</p>
              <p className="text-sm text-muted-foreground">{g.address}</p>
              <p className="text-xs text-muted-foreground">Owner: {g.owner?.full_name || "Unknown"}</p>
              <p className="text-xs text-muted-foreground">Orders: {g.orderCount} • Pending: {g.pendingCount} • Revenue: Rs {g.revenue}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge>{g.owner?.account_status || "pending"}</Badge>
              <div className="flex gap-2">
                {(g.owner?.account_status === "pending" || g.owner?.account_status === "rejected" || g.owner?.account_status === "blocked") && (
                  <Button size="sm" onClick={() => updateOwnerStatus(g.owner_id, "approved")}>Approve</Button>
                )}
                {g.owner?.account_status !== "blocked" && (
                  <Button size="sm" variant="destructive" onClick={() => updateOwnerStatus(g.owner_id, "blocked")}>Block</Button>
                )}
                {g.owner?.account_status === "pending" && (
                  <Button size="sm" variant="outline" onClick={() => updateOwnerStatus(g.owner_id, "rejected")}>Reject</Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      {rows.length === 0 && <Card><CardContent className="p-6 text-center text-muted-foreground">No garages yet</CardContent></Card>}
    </div>
  );
};

export default AdminGarages;
