import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Shield, Eye, Flag, FlagOff } from "lucide-react";
import DocumentPreviewDialog from "@/components/DocumentPreviewDialog";

const statusColor: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  rejected: "bg-red-100 text-red-800",
  blocked: "bg-red-200 text-red-900",
};

const AdminDrivers = () => {
  const { toast } = useToast();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchDrivers = async () => {
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "driver");
    if (!roles || roles.length === 0) { setDrivers([]); setLoading(false); return; }
    const ids = roles.map(r => r.user_id);
    const [profilesR, driverProfilesR, ratingsR] = await Promise.all([
      supabase.from("profiles").select("*").in("id", ids).order("created_at", { ascending: false }),
      supabase.from("driver_profiles").select("*").in("id", ids),
      supabase.from("ratings").select("to_user_id, rating").in("to_user_id", ids),
    ]);
    const dpMap = Object.fromEntries((driverProfilesR.data || []).map(d => [d.id, d]));
    const ratingMap: Record<string, { sum: number; count: number }> = {};
    (ratingsR.data || []).forEach(r => {
      if (!r.to_user_id) return;
      if (!ratingMap[r.to_user_id]) ratingMap[r.to_user_id] = { sum: 0, count: 0 };
      ratingMap[r.to_user_id].sum += r.rating;
      ratingMap[r.to_user_id].count += 1;
    });
    setDrivers((profilesR.data || []).map(p => ({
      ...p,
      dp: dpMap[p.id] || null,
      avgRating: ratingMap[p.id] ? (ratingMap[p.id].sum / ratingMap[p.id].count).toFixed(1) : "N/A",
    })));
    setLoading(false);
  };

  useEffect(() => { fetchDrivers(); }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("profiles").update({ account_status: status } as any).eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: `Driver ${status}` });
      await supabase.rpc("notify_user", {
        _user_id: id,
        _title: status === "approved" ? "Account Approved" : status === "rejected" ? "Account Rejected" : `Account ${status}`,
        _message: status === "approved" ? "Your driver account has been approved!" : `Your driver account has been ${status}.`,
        _type: `account_${status}`,
      });
      fetchDrivers();
    }
  };

  const toggleFlag = async (id: string, current: boolean) => {
    await supabase.from("profiles").update({ is_flagged: !current } as any).eq("id", id);
    toast({ title: !current ? "Flagged" : "Unflagged" }); fetchDrivers();
  };

  const DocLink = ({ url, label }: { url: string | null; label: string }) => {
    if (!url) return <span className="text-xs text-muted-foreground">{label}: —</span>;
    return (
      <button onClick={() => setPreviewImage(url)} className="text-xs text-primary hover:underline flex items-center gap-1">
        <Eye className="h-3 w-3" /> {label}
      </button>
    );
  };

  const filtered = drivers.filter(u => {
    if (tab === "pending") return u.account_status === "pending";
    if (tab === "blocked") return u.account_status === "blocked";
    if (tab === "flagged") return u.is_flagged;
    return true;
  });

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Drivers ({drivers.length})</h2>
      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto pb-1">
          <TabsList className="w-max min-w-full sm:min-w-0">
            <TabsTrigger value="all">All ({drivers.length})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({drivers.filter(u => u.account_status === "pending").length})</TabsTrigger>
            <TabsTrigger value="blocked">Blocked ({drivers.filter(u => u.account_status === "blocked").length})</TabsTrigger>
            <TabsTrigger value="flagged">Flagged ({drivers.filter(u => u.is_flagged).length})</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value={tab} className="mt-4 space-y-3">
          {filtered.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No drivers found</CardContent></Card>
          ) : filtered.map(u => (
            <Card key={u.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between min-w-0">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground flex items-center gap-2">
                      <span className="break-words">{u.full_name || "No name"}</span> {u.is_flagged && <Flag className="h-3.5 w-3.5 text-destructive shrink-0" />}
                    </p>
                    <p className="text-sm text-muted-foreground break-words">{u.email} • {u.phone || "N/A"} • {u.city || "N/A"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="whitespace-nowrap">★ {u.avgRating}</Badge>
                    <Badge className={statusColor[u.account_status] + " whitespace-nowrap"}>{u.account_status}</Badge>
                  </div>
                </div>

                {u.dp && (
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                      <p><span className="text-muted-foreground">Vehicle:</span> {u.dp.vehicle_type}</p>
                      <p><span className="text-muted-foreground">Brand:</span> {u.dp.vehicle_brand || "N/A"}</p>
                      <p><span className="text-muted-foreground">License:</span> {u.dp.license_number || "N/A"}</p>
                      <p><span className="text-muted-foreground">Mode:</span> {u.dp.service_mode}</p>
                      <p><span className="text-muted-foreground">Online:</span> {u.dp.is_online ? "Yes" : "No"}</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <DocLink url={u.dp.national_id_url} label="National ID" />
                      <DocLink url={u.dp.vehicle_registration_url} label="Registration" />
                      <DocLink url={u.dp.profile_photo_url} label="Photo" />
                      <DocLink url={u.dp.vehicle_photo_url} label="Vehicle" />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {u.account_status === "pending" && (
                    <>
                      <Button size="sm" onClick={() => updateStatus(u.id, "approved")}><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Approve</Button>
                      <Button size="sm" variant="destructive" onClick={() => updateStatus(u.id, "rejected")}><XCircle className="h-3.5 w-3.5 mr-1" />Reject</Button>
                    </>
                  )}
                  {u.account_status !== "blocked" && u.account_status !== "pending" && (
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

      <DocumentPreviewDialog
        open={!!previewImage}
        title="Driver Document Preview"
        url={previewImage}
        onOpenChange={() => setPreviewImage(null)}
      />
    </div>
  );
};

export default AdminDrivers;
