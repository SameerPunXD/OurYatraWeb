import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import StatsCard from "@/components/dashboard/StatsCard";
import { CreditCard, DollarSign } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const AdminSubscriptions = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentTab, setPaymentTab] = useState("pending");
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);

    const [subscriptionsRes, paymentsRes] = await Promise.all([
      supabase.from("subscriptions").select("*, subscription_plans(*)").order("created_at", { ascending: false }),
      supabase.from("subscription_payments").select("*, subscription_plans(*)").order("created_at", { ascending: false }),
    ]);

    const subscriptions = subscriptionsRes.data || [];
    const paymentRows = paymentsRes.data || [];

    const userIds = [...new Set([...subscriptions.map((s) => s.user_id), ...paymentRows.map((p) => p.user_id)])];
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("id, full_name, phone").in("id", userIds)
      : { data: [] as any[] };

    const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

    const enrichedSubs = subscriptions.map((s) => ({
      ...s,
      user_name: profileMap[s.user_id]?.full_name || "Unknown",
      user_phone: profileMap[s.user_id]?.phone || "",
    }));

    const enrichedPayments = paymentRows.map((p) => ({
      ...p,
      user_name: profileMap[p.user_id]?.full_name || "Unknown",
      user_phone: profileMap[p.user_id]?.phone || "",
    }));

    setSubs(enrichedSubs);
    setPayments(enrichedPayments);
    setTotalRevenue(
      enrichedSubs
        .filter((s) => s.status === "active")
        .reduce((sum, s) => sum + Number(s.subscription_plans?.price || 0), 0)
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = subs.filter((s) => {
    if (tab === "active") return s.status === "active";
    if (tab === "expired") return s.status === "expired";
    if (tab === "cancelled") return s.status === "cancelled";
    return true;
  });

  const paymentFiltered = payments.filter((p) => {
    if (paymentTab === "pending") return p.status === "pending";
    if (paymentTab === "approved") return p.status === "approved";
    if (paymentTab === "rejected") return p.status === "rejected";
    return true;
  });

  const getPlanDurationMonths = (planName?: string) => {
    if (!planName) return 1;
    const normalized = planName.toLowerCase();
    if (normalized.includes("1 year") || normalized.includes("12 month")) return 12;
    if (normalized.includes("5 month")) return 5;
    if (normalized.includes("1 month")) return 1;
    return 1;
  };

  const activateSubscription = async (payment: any) => {
    const now = new Date();
    const end = new Date(now);
    const durationMonths = getPlanDurationMonths(payment?.subscription_plans?.name);
    end.setMonth(end.getMonth() + durationMonths);

    const { data: activeSub } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", payment.user_id)
      .eq("status", "active")
      .maybeSingle();

    if (activeSub?.id) {
      const { error } = await supabase
        .from("subscriptions")
        .update({
          plan_id: payment.plan_id,
          status: "active",
          starts_at: now.toISOString(),
          ends_at: end.toISOString(),
        })
        .eq("id", activeSub.id);
      return error;
    }

    const { error } = await supabase.from("subscriptions").insert({
      user_id: payment.user_id,
      plan_id: payment.plan_id,
      status: "active",
      starts_at: now.toISOString(),
      ends_at: end.toISOString(),
    } as any);

    return error;
  };

  const handleReview = async (payment: any, status: "approved" | "rejected") => {
    if (!user) return;
    setProcessingId(payment.id);

    try {
      const note = reviewNote[payment.id] || "";

      const { error: paymentUpdateError } = await supabase
        .from("subscription_payments")
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          review_note: note,
        } as any)
        .eq("id", payment.id)
        .eq("status", "pending");

      if (paymentUpdateError) throw paymentUpdateError;

      if (status === "approved") {
        const subError = await activateSubscription(payment);
        if (subError) throw subError;
      }

      toast({ title: `Payment ${status}` });
      await load();
    } catch (error: any) {
      toast({ title: "Action failed", description: error?.message || "Could not update payment.", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Subscriptions ({subs.length})</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatsCard title="Active Subscriptions" value={subs.filter((s) => s.status === "active").length} icon={CreditCard} description="Current" />
        <StatsCard title="Monthly Revenue" value={`Rs ${totalRevenue}`} icon={DollarSign} description="From active subs" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All ({subs.length})</TabsTrigger>
          <TabsTrigger value="active">Active ({subs.filter((s) => s.status === "active").length})</TabsTrigger>
          <TabsTrigger value="expired">Expired ({subs.filter((s) => s.status === "expired").length})</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled ({subs.filter((s) => s.status === "cancelled").length})</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4 space-y-2">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">No subscriptions found</CardContent>
            </Card>
          ) : (
            filtered.map((s) => (
              <Card key={s.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{s.user_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {s.subscription_plans?.name} — Rs {s.subscription_plans?.price}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge className={s.status === "active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>{s.status}</Badge>
                    <p className="text-xs text-muted-foreground mt-1">Expires: {new Date(s.ends_at).toLocaleDateString()}</p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <div className="space-y-3">
        <h3 className="text-xl font-semibold text-foreground">Payment Requests</h3>
        <Tabs value={paymentTab} onValueChange={setPaymentTab}>
          <TabsList>
            <TabsTrigger value="pending">Pending ({payments.filter((p) => p.status === "pending").length})</TabsTrigger>
            <TabsTrigger value="approved">Approved ({payments.filter((p) => p.status === "approved").length})</TabsTrigger>
            <TabsTrigger value="rejected">Rejected ({payments.filter((p) => p.status === "rejected").length})</TabsTrigger>
            <TabsTrigger value="all">All ({payments.length})</TabsTrigger>
          </TabsList>

          <TabsContent value={paymentTab} className="mt-4 space-y-3">
            {paymentFiltered.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">No payment requests found</CardContent>
              </Card>
            ) : (
              paymentFiltered.map((p) => (
                <Card key={p.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{p.user_name}</p>
                        <p className="text-sm text-muted-foreground">{p.user_phone || "No phone"}</p>
                        <p className="text-sm text-muted-foreground">
                          {p.subscription_plans?.name || "Plan"} • Rs {p.expected_amount}
                        </p>
                        <p className="text-sm text-muted-foreground">Ref: {p.ref_id || "—"}</p>
                        <p className="text-sm text-muted-foreground">Paid from: {p.raw_response?.payer_phone || "—"}</p>
                        <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</p>
                      </div>
                      <Badge
                        className={
                          p.status === "approved"
                            ? "bg-green-100 text-green-800"
                            : p.status === "rejected"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                        }
                      >
                        {p.status}
                      </Badge>
                    </div>

                    {p.screenshot_url ? (
                      <a href={p.screenshot_url} target="_blank" rel="noreferrer" className="block">
                        <img src={p.screenshot_url} alt="Payment proof" className="h-48 rounded-md border object-cover" />
                      </a>
                    ) : (
                      <p className="text-sm text-muted-foreground">No screenshot uploaded.</p>
                    )}

                    {p.status === "pending" && (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Optional review note"
                          value={reviewNote[p.id] || ""}
                          onChange={(e) => setReviewNote((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        />
                        <div className="flex gap-2">
                          <Button disabled={processingId === p.id} onClick={() => handleReview(p, "approved")}>Approve</Button>
                          <Button variant="destructive" disabled={processingId === p.id} onClick={() => handleReview(p, "rejected")}>Reject</Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminSubscriptions;
