import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Shield, Flag, FlagOff } from "lucide-react";

const AdminUsers = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");

  const fetchUsers = async () => {
    const { data } = await supabase.from("profiles").select("*, user_roles(role)").order("created_at", { ascending: false });
    setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const updateStatus = async (userId: string, status: string) => {
    const { error } = await supabase.from("profiles").update({ account_status: status } as any).eq("id", userId);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: `User ${status}` }); fetchUsers(); }
  };

  const toggleFlag = async (userId: string, current: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_flagged: !current } as any).eq("id", userId);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: !current ? "User flagged" : "Flag removed" }); fetchUsers(); }
  };

  const filteredUsers = users.filter(u => {
    if (tab === "pending") return (u as any).account_status === "pending";
    if (tab === "blocked") return (u as any).account_status === "blocked";
    if (tab === "flagged") return (u as any).is_flagged;
    return true;
  });

  const statusColor: Record<string, string> = {
    approved: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    rejected: "bg-red-100 text-red-800",
    blocked: "bg-red-200 text-red-900",
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Users ({users.length})</h2>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All ({users.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({users.filter(u => (u as any).account_status === "pending").length})</TabsTrigger>
          <TabsTrigger value="blocked">Blocked ({users.filter(u => (u as any).account_status === "blocked").length})</TabsTrigger>
          <TabsTrigger value="flagged">Flagged ({users.filter(u => (u as any).is_flagged).length})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 space-y-2">
          {filteredUsers.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No users in this category</CardContent></Card>
          ) : filteredUsers.map(u => (
            <Card key={u.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-foreground flex items-center gap-2">
                      {u.full_name || "No name"}
                      {(u as any).is_flagged && <Flag className="h-4 w-4 text-destructive" />}
                    </p>
                    <p className="text-sm text-muted-foreground">{u.email} • {u.phone || "No phone"}</p>
                    {(u as any).city && <p className="text-xs text-muted-foreground">City: {(u as any).city}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {(u.user_roles || []).map((r: any) => (
                      <Badge key={r.role} variant="secondary">{r.role}</Badge>
                    ))}
                    <Badge className={statusColor[(u as any).account_status] || ""}>{(u as any).account_status}</Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(u as any).account_status === "pending" && (
                    <Button size="sm" variant="default" className="gap-1" onClick={() => updateStatus(u.id, "approved")}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </Button>
                  )}
                  {(u as any).account_status === "pending" && (
                    <Button size="sm" variant="destructive" className="gap-1" onClick={() => updateStatus(u.id, "rejected")}>
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </Button>
                  )}
                  {(u as any).account_status !== "blocked" && (u as any).account_status !== "pending" && (
                    <Button size="sm" variant="destructive" className="gap-1" onClick={() => updateStatus(u.id, "blocked")}>
                      <Shield className="h-3.5 w-3.5" /> Block
                    </Button>
                  )}
                  {(u as any).account_status === "blocked" && (
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => updateStatus(u.id, "approved")}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Unblock
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="gap-1" onClick={() => toggleFlag(u.id, (u as any).is_flagged)}>
                    {(u as any).is_flagged ? <FlagOff className="h-3.5 w-3.5" /> : <Flag className="h-3.5 w-3.5" />}
                    {(u as any).is_flagged ? "Unflag" : "Flag"}
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

export default AdminUsers;
