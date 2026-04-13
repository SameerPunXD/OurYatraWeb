import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Shield, Flag, FlagOff } from "lucide-react";

const statusColor: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  rejected: "bg-red-100 text-red-800",
  blocked: "bg-red-200 text-red-900",
};

const AdminRestaurants = () => {
  const { toast } = useToast();
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");

  const fetch = async () => {
    const { data: rests } = await supabase.from("restaurants").select("*").order("created_at", { ascending: false });
    if (!rests) { setLoading(false); return; }
    const ownerIds = [...new Set(rests.map(r => r.owner_id))];
    const [profilesR, menuR, subsR] = await Promise.all([
      supabase.from("profiles").select("id, full_name, account_status, is_flagged").in("id", ownerIds),
      supabase.from("menu_items").select("restaurant_id"),
      supabase.from("subscriptions").select("user_id, status").in("user_id", ownerIds).eq("status", "active"),
    ]);
    const profileMap = Object.fromEntries((profilesR.data || []).map(p => [p.id, p]));
    const menuCounts: Record<string, number> = {};
    (menuR.data || []).forEach(m => { menuCounts[m.restaurant_id] = (menuCounts[m.restaurant_id] || 0) + 1; });
    const subMap = Object.fromEntries((subsR.data || []).map(s => [s.user_id, true]));

    setRestaurants(rests.map(r => ({
      ...r,
      ownerProfile: profileMap[r.owner_id] || {},
      menuCount: menuCounts[r.id] || 0,
      hasSub: !!subMap[r.owner_id],
    })));
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const updateOwnerStatus = async (ownerId: string, status: string) => {
    const { error } = await supabase.from("profiles").update({ account_status: status } as any).eq("id", ownerId);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: `Restaurant ${status}` });
      await supabase.rpc("notify_user", {
        _user_id: ownerId, _title: `Account ${status}`,
        _message: `Your restaurant account has been ${status}.`, _type: `account_${status}`,
      });
      fetch();
    }
  };

  const toggleFlag = async (ownerId: string, current: boolean) => {
    await supabase.from("profiles").update({ is_flagged: !current } as any).eq("id", ownerId);
    toast({ title: !current ? "Flagged" : "Unflagged" }); fetch();
  };

  const filtered = restaurants.filter(r => {
    const s = r.ownerProfile?.account_status;
    if (tab === "pending") return s === "pending";
    if (tab === "blocked") return s === "blocked";
    if (tab === "flagged") return r.ownerProfile?.is_flagged;
    return true;
  });

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Restaurants ({restaurants.length})</h2>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All ({restaurants.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({restaurants.filter(r => r.ownerProfile?.account_status === "pending").length})</TabsTrigger>
          <TabsTrigger value="blocked">Blocked ({restaurants.filter(r => r.ownerProfile?.account_status === "blocked").length})</TabsTrigger>
          <TabsTrigger value="flagged">Flagged ({restaurants.filter(r => r.ownerProfile?.is_flagged).length})</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4 space-y-3">
          {filtered.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No restaurants found</CardContent></Card>
          ) : filtered.map(r => (
            <Card key={r.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground flex items-center gap-2">
                      {r.name} {r.ownerProfile?.is_flagged && <Flag className="h-3.5 w-3.5 text-destructive" />}
                    </p>
                    <p className="text-sm text-muted-foreground">{r.address} • {r.cuisine_type || "N/A"}</p>
                    <p className="text-xs text-muted-foreground">Owner: {r.ownerProfile?.full_name || "Unknown"} • {r.menuCount} menu items • {r.is_open ? "Open" : "Closed"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.hasSub && <Badge variant="outline" className="text-xs">Subscribed</Badge>}
                    <Badge className={statusColor[r.ownerProfile?.account_status || "approved"]}>{r.ownerProfile?.account_status}</Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.ownerProfile?.account_status === "pending" && (
                    <>
                      <Button size="sm" onClick={() => updateOwnerStatus(r.owner_id, "approved")}><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Approve</Button>
                      <Button size="sm" variant="destructive" onClick={() => updateOwnerStatus(r.owner_id, "rejected")}><XCircle className="h-3.5 w-3.5 mr-1" />Reject</Button>
                    </>
                  )}
                  {r.ownerProfile?.account_status !== "blocked" && r.ownerProfile?.account_status !== "pending" && (
                    <Button size="sm" variant="destructive" onClick={() => updateOwnerStatus(r.owner_id, "blocked")}><Shield className="h-3.5 w-3.5 mr-1" />Block</Button>
                  )}
                  {r.ownerProfile?.account_status === "blocked" && (
                    <Button size="sm" variant="outline" onClick={() => updateOwnerStatus(r.owner_id, "approved")}><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Unblock</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => toggleFlag(r.owner_id, r.ownerProfile?.is_flagged)}>
                    {r.ownerProfile?.is_flagged ? <FlagOff className="h-3.5 w-3.5" /> : <Flag className="h-3.5 w-3.5" />}
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

export default AdminRestaurants;
