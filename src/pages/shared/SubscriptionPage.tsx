import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Check, Upload, QrCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const PAYMENT_BUCKETS = ["payment-proofs", "uploads"] as const;
const PAYMENT_QR_URL = import.meta.env.VITE_SUBSCRIPTION_QR_URL || "";
const PAYMENT_ACCOUNT_NAME = import.meta.env.VITE_SUBSCRIPTION_ACCOUNT_NAME || "OurYatra Pvt. Ltd.";
const PAYMENT_PHONE = import.meta.env.VITE_SUBSCRIPTION_ACCOUNT_PHONE || "9800000000";
const PAYMENT_NOTE = import.meta.env.VITE_SUBSCRIPTION_PAYMENT_NOTE || "Pay exact amount and upload payment screenshot.";

const normalizePlanNameForDisplay = (name?: string) => {
  if (!name) return "";
  return name.replace(/\bRider\b/gi, "User");
};

const SubscriptionPage = () => {
  const { user, activeRole } = useAuth();
  const { toast } = useToast();
  const [plans, setPlans] = useState<any[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);
  const [proofFiles, setProofFiles] = useState<Record<string, File | null>>({});
  const [paymentRefs, setPaymentRefs] = useState<Record<string, string>>({});
  const [payerPhones, setPayerPhones] = useState<Record<string, string>>({});
  const [myPayments, setMyPayments] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [qrPreviewOpen, setQrPreviewOpen] = useState(false);
  const [isAutoDriver, setIsAutoDriver] = useState(false);
  const [userCustomRoleSlugs, setUserCustomRoleSlugs] = useState<string[]>([]);
  const [requireBusOperatorSubscription, setRequireBusOperatorSubscription] = useState(true);
  const location = useLocation();

  const pendingPlanIds = useMemo(
    () => new Set(myPayments.filter((p) => p.status === "pending").map((p) => p.plan_id)),
    [myPayments]
  );
  const hasAnyPendingPayment = useMemo(() => myPayments.some((p) => p.status === "pending"), [myPayments]);

  const fetchData = async () => {
    if (!user || !activeRole) return;

    const [plansRes, subRes, paymentsRes, driverProfileRes, customRoleRes, settingsRes] = await Promise.all([
      supabase.from("subscription_plans").select("*").eq("role", activeRole).eq("is_active", true),
      supabase.from("subscriptions").select("*, subscription_plans(*)").eq("user_id", user.id).eq("status", "active").maybeSingle(),
      supabase
        .from("subscription_payments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
      activeRole === "driver"
        ? supabase.from("driver_profiles").select("vehicle_type").eq("id", user.id).maybeSingle()
        : Promise.resolve({ data: null } as any),
      supabase.from("user_custom_roles" as any).select("role_slug").eq("user_id", user.id),
      activeRole === "bus_operator"
        ? supabase
            .from("app_settings" as any)
            .select("value_bool")
            .eq("key", "require_bus_operator_subscription")
            .maybeSingle()
        : Promise.resolve({ data: { value_bool: true } } as any),
    ]);

    const vehicleType = ((driverProfileRes as any)?.data?.vehicle_type || "").toLowerCase();
    const customSlugs = ((customRoleRes as any)?.data || []).map((r: any) => r.role_slug);
    setUserCustomRoleSlugs(customSlugs);

    const autoDriver = activeRole === "driver" && (vehicleType === "auto" || customSlugs.includes("auto_driver"));
    setIsAutoDriver(autoDriver);

    const allPlans = plansRes.data || [];
    const filteredPlans = activeRole === "driver"
      ? allPlans.filter((p: any) => {
          const customSlug = p?.custom_role_slug as string | null;
          if (customSlug) return customSlugs.includes(customSlug);
          const isAutoPlanByName = String(p?.name || "").toLowerCase().includes("auto driver");
          return autoDriver ? isAutoPlanByName : !isAutoPlanByName;
        })
      : allPlans;

    setPlans(filteredPlans);
    setSubscription(subRes.data);
    setMyPayments(paymentsRes.data || []);
    setRequireBusOperatorSubscription((settingsRes.data as any)?.value_bool ?? true);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    window.addEventListener("focus", fetchData);
    return () => window.removeEventListener("focus", fetchData);
  }, [user, activeRole, location.pathname]);

  const handleProofFileChange = (planId: string, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setProofFiles((prev) => ({ ...prev, [planId]: file }));
  };

  const handleRefChange = (planId: string, value: string) => {
    setPaymentRefs((prev) => ({ ...prev, [planId]: value }));
  };

  const handlePayerPhoneChange = (planId: string, value: string) => {
    setPayerPhones((prev) => ({ ...prev, [planId]: value }));
  };

  const handleSubscribe = async (plan: any) => {
    if (!user) return;
    const selectedFile = proofFiles[plan.id];
    const paymentRef = (paymentRefs[plan.id] || "").trim();
    const payerPhone = (payerPhones[plan.id] || "").trim();

    if (!selectedFile) {
      toast({ title: "Upload required", description: "Please upload payment screenshot before submitting.", variant: "destructive" });
      return;
    }

    if (!paymentRef) {
      toast({ title: "Reference required", description: "Please enter transaction/reference ID.", variant: "destructive" });
      return;
    }

    const maxSizeBytes = 5 * 1024 * 1024;
    if (selectedFile.size > maxSizeBytes) {
      toast({ title: "File too large", description: "Please upload an image under 5 MB.", variant: "destructive" });
      return;
    }

    setProcessingPlanId(plan.id);

    try {
      const ext = selectedFile.name.split(".").pop() || "jpg";
      const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const transactionUuid = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const filePath = `${user.id}/${transactionUuid}.${safeExt}`;

      let usedBucket: string | null = null;
      let lastUploadError: any = null;

      for (const bucket of PAYMENT_BUCKETS) {
        const uploadRes = await supabase.storage.from(bucket).upload(filePath, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });

        if (!uploadRes.error) {
          usedBucket = bucket;
          lastUploadError = null;
          break;
        }

        lastUploadError = uploadRes.error;
      }

      if (!usedBucket) throw lastUploadError || new Error("Could not upload payment proof.");

      const { data: publicUrlData } = supabase.storage.from(usedBucket).getPublicUrl(filePath);

      const { error: insertError } = await supabase.from("subscription_payments").insert({
        user_id: user.id,
        plan_id: plan.id,
        transaction_uuid: transactionUuid,
        expected_amount: Number(plan.price),
        paid_amount: Number(plan.price),
        status: "pending",
        provider: "manual_qr",
        environment: "manual",
        screenshot_url: publicUrlData.publicUrl,
        payment_method: "esewa_qr",
        ref_id: paymentRef,
        raw_response: {
          payer_phone: payerPhone || null,
          submitted_via: "manual_qr",
        },
      } as any);

      if (insertError) throw insertError;

      toast({
        title: "Payment submitted",
        description: "Your payment proof is submitted and waiting for admin approval.",
      });

      setProofFiles((prev) => ({ ...prev, [plan.id]: null }));
      setPaymentRefs((prev) => ({ ...prev, [plan.id]: "" }));
      setPayerPhones((prev) => ({ ...prev, [plan.id]: "" }));
      setSelectedPlanId(null);
      await fetchData();
    } catch (error: any) {
      toast({
        title: "Submission failed",
        description: error?.message || "Could not submit payment proof.",
        variant: "destructive",
      });
    } finally {
      setProcessingPlanId(null);
    }
  };

  const handleCancel = async () => {
    if (!subscription) return;
    const { error } = await supabase.from("subscriptions").update({ status: "cancelled" }).eq("id", subscription.id);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Subscription cancelled" });
      setSubscription(null);
    }
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  const shouldShowPlans = activeRole !== "bus_operator" || requireBusOperatorSubscription;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Subscription</h2>
      {activeRole === "driver" && (
        <p className="text-sm text-muted-foreground">
          Showing {isAutoDriver ? "Auto Driver" : "Driver"} packages based on your selected vehicle type.
        </p>
      )}
      {activeRole === "bus_operator" && !requireBusOperatorSubscription && (
        <Card className="border-emerald-200 bg-emerald-50/60">
          <CardContent className="p-6">
            <Badge className="mb-2 bg-emerald-100 text-emerald-800">No payment required</Badge>
            <h3 className="text-lg font-semibold text-foreground">Bus operator subscription is turned off</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Admin has disabled bus operator subscription charges. You can manage buses and bookings without buying a plan right now.
            </p>
          </CardContent>
        </Card>
      )}

      {subscription && (
        <Card className="border-primary">
          <CardContent className="p-6">
            <Badge className="bg-green-100 text-green-800 mb-2">Active</Badge>
            <h3 className="text-lg font-semibold">{normalizePlanNameForDisplay((subscription as any).subscription_plans?.name)}</h3>
            <p className="text-2xl font-bold text-primary mt-1">Rs {(subscription as any).subscription_plans?.price}</p>
            <p className="text-sm text-muted-foreground mt-2">Expires: {new Date(subscription.ends_at).toLocaleDateString()}</p>
            <Button type="button" variant="destructive" size="sm" className="mt-4" onClick={handleCancel}>
              Cancel Subscription
            </Button>
          </CardContent>
        </Card>
      )}


      {shouldShowPlans && hasAnyPendingPayment && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          You already have a pending payment request. Please wait for admin review before submitting another one.
        </p>
      )}

      {shouldShowPlans && (
        <div className="grid gap-4 sm:grid-cols-2">
          {plans.map((plan) => {
            const features = Array.isArray(plan.features) ? plan.features : [];
            const isActive = subscription?.plan_id === plan.id;
            const hasPending = pendingPlanIds.has(plan.id);
            const selectedFile = proofFiles[plan.id];
            const selectedRef = paymentRefs[plan.id] || "";
            const selectedPayerPhone = payerPhones[plan.id] || "";

            return (
              <Card key={plan.id} className={isActive ? "border-primary" : ""}>
                <CardHeader>
                  <CardTitle>{normalizePlanNameForDisplay(plan.name)}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-3xl font-bold text-foreground">
                    Rs {plan.price}
                    <span className="text-sm font-normal text-muted-foreground">/plan</span>
                  </p>

                  <ul className="space-y-2">
                    {features.map((f: string, i: number) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-primary" /> {f}
                      </li>
                    ))}
                  </ul>

                  {!isActive && selectedPlanId !== plan.id && (
                    <Button type="button" className="w-full" variant="outline" onClick={() => setSelectedPlanId(plan.id)}>
                      Choose this plan
                    </Button>
                  )}

                  {!isActive && selectedPlanId === plan.id && (
                    <div className="space-y-3 rounded-md border p-3">
                      <p className="text-sm font-semibold text-foreground">How to pay</p>
                      <p className="text-xs text-muted-foreground">1) Scan QR and pay exact amount for this plan.</p>
                      <p className="text-xs text-muted-foreground">2) Add reference ID and upload screenshot.</p>
                      <p className="text-xs text-muted-foreground">3) Admin verifies and activates subscription.</p>
                      <p className="text-xs text-foreground font-medium">Account: {PAYMENT_ACCOUNT_NAME} ({PAYMENT_PHONE})</p>
                      <p className="text-xs text-muted-foreground">{PAYMENT_NOTE}</p>

                      {PAYMENT_QR_URL ? (
                        <button type="button" className="block" onClick={() => setQrPreviewOpen(true)}>
                          <img src={PAYMENT_QR_URL} alt="Subscription payment QR" className="h-56 w-full rounded-md border object-contain bg-muted" />
                          <span className="mt-1 inline-flex items-center gap-1 text-xs text-primary"><QrCode className="h-3.5 w-3.5" /> Tap to view full QR</span>
                        </button>
                      ) : (
                        <div className="h-48 w-full rounded-md border grid place-items-center text-center px-3 text-xs">
                          Add <code>VITE_SUBSCRIPTION_QR_URL</code> in .env to show your QR image.
                        </div>
                      )}

                      <label className="text-sm font-medium text-foreground">Transaction / Reference ID *</label>
                      <Input
                        placeholder="Example: 4R5F7H2J"
                        value={selectedRef}
                        onChange={(e) => handleRefChange(plan.id, e.target.value)}
                      />
                      <label className="text-sm font-medium text-foreground">Payer phone (optional)</label>
                      <Input
                        placeholder="98XXXXXXXX"
                        value={selectedPayerPhone}
                        onChange={(e) => handlePayerPhoneChange(plan.id, e.target.value)}
                      />
                      <label className="text-sm font-medium text-foreground">Upload payment screenshot *</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleProofFileChange(plan.id, e)}
                        className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5 file:text-sm"
                      />
                      {selectedFile && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Upload className="h-3.5 w-3.5" /> {selectedFile.name}
                        </p>
                      )}

                      <Button
                        type="button"
                        className="w-full"
                        variant={isActive ? "secondary" : "default"}
                        disabled={isActive || hasPending || hasAnyPendingPayment || !!processingPlanId}
                        onClick={() => handleSubscribe(plan)}
                      >
                        {isActive
                          ? "Current Plan"
                          : hasPending || hasAnyPendingPayment
                          ? "Payment Under Review"
                          : processingPlanId === plan.id
                          ? "Submitting proof..."
                          : "Submit Payment Proof"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={qrPreviewOpen} onOpenChange={setQrPreviewOpen}>
        <DialogContent className="max-w-2xl p-4">
          <DialogTitle className="text-base">Scan QR to pay</DialogTitle>
          {PAYMENT_QR_URL && (
            <img src={PAYMENT_QR_URL} alt="Full payment QR" className="w-full max-h-[80vh] object-contain rounded-md border" />
          )}
        </DialogContent>
      </Dialog>

      {myPayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent payment requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {myPayments.slice(0, 5).map((payment) => (
              <div key={payment.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="font-medium text-sm">{payment.payment_method || "manual"} • Rs {payment.expected_amount}</p>
                  <p className="text-xs text-muted-foreground">Ref: {payment.ref_id || "—"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(payment.created_at).toLocaleString()}</p>
                </div>
                <Badge
                  className={
                    payment.status === "approved"
                      ? "bg-green-100 text-green-800"
                      : payment.status === "rejected"
                      ? "bg-red-100 text-red-800"
                      : "bg-amber-100 text-amber-800"
                  }
                >
                  {payment.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SubscriptionPage;
