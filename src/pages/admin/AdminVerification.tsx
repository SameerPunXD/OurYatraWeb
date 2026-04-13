import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Eye } from "lucide-react";
import DocumentPreviewDialog from "@/components/DocumentPreviewDialog";

const AdminVerification = () => {
  const { toast } = useToast();
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchPending = async () => {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*, user_roles(role)")
      .eq("account_status", "pending" as any)
      .order("created_at", { ascending: false });

    if (!profiles) { setLoading(false); return; }

    // Fetch driver/restaurant details for each
    const enriched = await Promise.all(profiles.map(async (p) => {
      const role = (p.user_roles as any)?.[0]?.role;
      let details: any = null;
      if (role === "driver") {
        const { data } = await supabase.from("driver_profiles").select("*").eq("id", p.id).single();
        details = data;
      } else if (role === "restaurant") {
        const { data } = await supabase.from("restaurants").select("*").eq("owner_id", p.id).single();
        details = data;
      } else if (role === "garage") {
        const { data } = await (supabase as any).from("garages").select("*").eq("owner_id", p.id).single();
        details = data;
      }
      return { ...p, role, details };
    }));

    setPendingUsers(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchPending(); }, []);

  const updateStatus = async (userId: string, status: string) => {
    const { error } = await supabase.from("profiles").update({ account_status: status } as any).eq("id", userId);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: status === "approved" ? "User approved!" : "User rejected" });
      // Send notification via RPC (bypasses RLS)
      await supabase.rpc("notify_user", {
        _user_id: userId,
        _title: status === "approved" ? "Account Approved" : "Account Rejected",
        _message: status === "approved" ? "Your account has been approved! You can now log in." : "Your account application was rejected. Contact support for details.",
        _type: `account_${status}`,
      });
      fetchPending();
    }
  };

  const DocLink = ({ url, label }: { url: string | null; label: string }) => {
    if (!url) return <span className="text-xs text-muted-foreground">{label}: Not uploaded</span>;
    return (
      <button onClick={() => setPreviewImage(url)} className="text-xs text-primary hover:underline flex items-center gap-1">
        <Eye className="h-3 w-3" /> {label}
      </button>
    );
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Verification Queue ({pendingUsers.length})</h2>

      {pendingUsers.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No pending applications</CardContent></Card>
      ) : (
        pendingUsers.map(u => (
          <Card key={u.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{u.full_name || "No name"}</CardTitle>
                <Badge variant="secondary">{u.role}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p><span className="text-muted-foreground">Email:</span> {u.email}</p>
                <p><span className="text-muted-foreground">Phone:</span> {u.phone || "N/A"}</p>
                <p><span className="text-muted-foreground">City:</span> {u.city || "N/A"}</p>
                <p><span className="text-muted-foreground">Joined:</span> {new Date(u.created_at).toLocaleDateString()}</p>
              </div>

              {u.role === "driver" && u.details && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium text-foreground">Driver Details</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p><span className="text-muted-foreground">Vehicle:</span> {u.details.vehicle_type}</p>
                    <p><span className="text-muted-foreground">Brand:</span> {u.details.vehicle_brand || "N/A"}</p>
                    <p><span className="text-muted-foreground">License:</span> {u.details.license_number}</p>
                    <p><span className="text-muted-foreground">Availability:</span> {u.details.availability}</p>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2">
                    <DocLink url={u.details.national_id_url} label="National ID" />
                    <DocLink url={u.details.vehicle_registration_url} label="Vehicle Registration" />
                    <DocLink url={u.details.profile_photo_url} label="Profile Photo" />
                    <DocLink url={u.details.vehicle_photo_url} label="Vehicle Photo" />
                  </div>
                </div>
              )}

              {u.role === "restaurant" && u.details && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium text-foreground">Restaurant Details</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p><span className="text-muted-foreground">Name:</span> {u.details.name}</p>
                    <p><span className="text-muted-foreground">Address:</span> {u.details.address}</p>
                    <p><span className="text-muted-foreground">Cuisine:</span> {u.details.cuisine_type || "N/A"}</p>
                    <p><span className="text-muted-foreground">Hours:</span> {u.details.opening_time} - {u.details.closing_time}</p>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2">
                    <DocLink url={u.details.business_license_url} label="Business License" />
                    <DocLink url={u.details.image_url} label="Logo" />
                  </div>
                </div>
              )}

              {u.role === "garage" && u.details && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium text-foreground">Garage Details</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p><span className="text-muted-foreground">Name:</span> {u.details.name}</p>
                    <p><span className="text-muted-foreground">Address:</span> {u.details.address}</p>
                    <p><span className="text-muted-foreground">Phone:</span> {u.details.phone || "N/A"}</p>
                    <p><span className="text-muted-foreground">Open:</span> {u.details.is_open ? "Yes" : "No"}</p>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2">
                    <DocLink url={u.details.image_url} label="Garage Logo" />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button size="sm" className="gap-1" onClick={() => updateStatus(u.id, "approved")}>
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </Button>
                <Button size="sm" variant="destructive" className="gap-1" onClick={() => updateStatus(u.id, "rejected")}>
                  <XCircle className="h-4 w-4" /> Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <DocumentPreviewDialog
        open={!!previewImage}
        title="Document Preview"
        url={previewImage}
        onOpenChange={() => setPreviewImage(null)}
      />
    </div>
  );
};

export default AdminVerification;
