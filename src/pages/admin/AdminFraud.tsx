import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Shield, Flag, FlagOff, CheckCircle2 } from "lucide-react";

const statusColor: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  rejected: "bg-red-100 text-red-800",
  blocked: "bg-red-200 text-red-900",
};

const AdminFraud = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("flagged");
  const [blockDialog, setBlockDialog] = useState<{ id: string; name: string } | null>(null);
  const [reason, setReason] = useState("");

  const fetchUsers = async () => {
    const { data } = await supabase.from("profiles").select("*, user_roles(role)").order("updated_at", { ascending: false });
    setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const blockUser = async () => {
    if (!blockDialog) return;
    const { error } = await supabase.from("profiles").update({ account_status: "blocked", is_flagged: true } as any).eq("id", blockDialog.id);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    await supabase.rpc("notify_user", {
      _user_id: blockDialog.id,
      _title: "Account Blocked",
      _message: `Your account has been blocked. Reason: ${reason || "Suspicious activity"}`,
      _type: "account_blocked",
    });
    toast({ title: "User blocked" });
    setBlockDialog(null);
    setReason("");
    fetchUsers();
  };

  const unblockUser = async (id: string) => {
    await supabase.from("profiles").update({ account_status: "approved", is_flagged: false } as any).eq("id", id);
    toast({ title: "User unblocked" }); fetchUsers();
  };

  const toggleFlag = async (id: string, current: boolean) => {
    await supabase.from("profiles").update({ is_flagged: !current } as any).eq("id", id);
    toast({ title: !current ? "Flagged" : "Unflagged" }); fetchUsers();
  };

  const filtered = users.filter(u => {
    if (tab === "flagged") return u.is_flagged;
    if (tab === "blocked") return u.account_status === "blocked";
    return u.is_flagged || u.account_status === "blocked";
  });

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Fraud & Account Management</h2>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="flagged">Flagged ({users.filter(u => u.is_flagged).length})</TabsTrigger>
          <TabsTrigger value="blocked">Blocked ({users.filter(u => u.account_status === "blocked").length})</TabsTrigger>
          <TabsTrigger value="all">All Suspicious</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4 space-y-2">
          {filtered.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No suspicious accounts</CardContent></Card>
          ) : filtered.map(u => (
            <Card key={u.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground flex items-center gap-2">
                    {u.full_name || "No name"} {u.is_flagged && <Flag className="h-3.5 w-3.5 text-destructive" />}
                  </p>
                  <p className="text-sm text-muted-foreground">{u.email} • {u.phone || "N/A"}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {(u.user_roles || []).map((r: any) => <Badge key={r.role} variant="secondary" className="text-xs">{r.role}</Badge>)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Last updated: {new Date(u.updated_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={statusColor[u.account_status]}>{u.account_status}</Badge>
                  {u.account_status !== "blocked" && (
                    <Button size="sm" variant="destructive" onClick={() => setBlockDialog({ id: u.id, name: u.full_name || u.email })}>
                      <Shield className="h-3.5 w-3.5 mr-1" />Block
                    </Button>
                  )}
                  {u.account_status === "blocked" && (
                    <Button size="sm" variant="outline" onClick={() => unblockUser(u.id)}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Unblock
                    </Button>
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

      <Dialog open={!!blockDialog} onOpenChange={() => setBlockDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Block {blockDialog?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Reason for blocking</Label>
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Suspicious activity, fake account" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={blockUser}>Block Account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminFraud;
