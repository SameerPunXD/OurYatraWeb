import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Shield, Flag, FlagOff } from "lucide-react";

const statusColor: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  rejected: "bg-red-100 text-red-800",
  blocked: "bg-red-200 text-red-900",
};

const AdminRiders = () => {
  const { toast } = useToast();
  const [riders, setRiders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");

  const fetchRiders = async () => {
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "rider");
    if (!roles || roles.length === 0) { setRiders([]); setLoading(false); return; }
    const ids = roles.map(r => r.user_id);
    const { data: profiles } = await supabase.from("profiles").select("*").in("id", ids).order("created_at", { ascending: false });
    // Get ride counts
    const { data: rides } = await supabase.from("rides").select("rider_id").in("rider_id", ids);
    const rideCounts: Record<string, number> = {};
    (rides || []).forEach(r => { rideCounts[r.rider_id] = (rideCounts[r.rider_id] || 0) + 1; });
    setRiders((profiles || []).map(p => ({ ...p, rideCount: rideCounts[p.id] || 0 })));
    setLoading(false);
  };

  useEffect(() => { fetchRiders(); }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("profiles").update({ account_status: status } as any).eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: `User ${status}` }); fetchRiders(); }
  };

  const toggleFlag = async (id: string, current: boolean) => {
    await supabase.from("profiles").update({ is_flagged: !current } as any).eq("id", id);
    toast({ title: !current ? "Flagged" : "Unflagged" }); fetchRiders();
  };

  const filtered = riders.filter(u => {
    if (tab === "blocked") return u.account_status === "blocked";
    if (tab === "flagged") return u.is_flagged;
    return true;
  });

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Users ({riders.length})</h2>
      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto pb-1">
          <TabsList className="w-max min-w-full sm:min-w-0">
            <TabsTrigger value="all">All ({riders.length})</TabsTrigger>
            <TabsTrigger value="blocked">Blocked ({riders.filter(u => u.account_status === "blocked").length})</TabsTrigger>
            <TabsTrigger value="flagged">Flagged ({riders.filter(u => u.is_flagged).length})</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value={tab} className="mt-4 space-y-2">
          {filtered.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No users found</CardContent></Card>
          ) : filtered.map(u => (
            <Card key={u.id}>
              <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
                <div className="min-w-0">
                  <p className="font-medium text-foreground flex items-center gap-2">
                    <span className="break-words">{u.full_name || "No name"}</span> {u.is_flagged && <Flag className="h-3.5 w-3.5 text-destructive shrink-0" />}
                  </p>
                  <p className="text-sm text-muted-foreground break-words">{u.email} • {u.phone || "N/A"} • {u.city || "N/A"}</p>
                  <p className="text-xs text-muted-foreground">{u.rideCount} rides</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={statusColor[u.account_status] + " whitespace-nowrap"}>{u.account_status}</Badge>
                  {u.account_status !== "blocked" && (
                    <Button size="sm" variant="destructive" onClick={() => updateStatus(u.id, "blocked")}><Shield className="h-3.5 w-3.5 mr-1" />Block</Button>
                  )}
                  {u.account_status === "blocked" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(u.id, "approved")}><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Unblock</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => toggleFlag(u.id, u.is_flagged)}>
                    {u.is_flagged ? <FlagOff className="h-3.5 w-3.5" /> : <Flag className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminRiders;
