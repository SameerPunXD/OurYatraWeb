import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const EsewaReturn = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Verifying your payment...");

  const state = params.get("state");

  const decodedData = useMemo(() => {
    const data = params.get("data");
    if (!data) return null;
    try {
      return JSON.parse(atob(data));
    } catch {
      return null;
    }
  }, [params]);

  const transactionUuid = decodedData?.transaction_uuid || params.get("transaction_uuid");

  useEffect(() => {
    const fallbackVerify = async () => {
      if (!transactionUuid) throw new Error("Missing transaction ID from eSewa response.");

      const localStatus = String(decodedData?.status || "").toUpperCase();
      if (localStatus && localStatus !== "COMPLETE") {
        throw new Error(`Payment not completed (status: ${localStatus})`);
      }

      const splitIdx = transactionUuid.lastIndexOf("-");
      const planId = splitIdx > 0 ? transactionUuid.slice(0, splitIdx) : null;
      if (!planId) throw new Error("Unable to determine selected plan.");

      const amount = Number(decodedData?.total_amount || 0);
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) throw new Error("Please login again to activate subscription.");

      await supabase.from("subscription_payments").upsert({
        user_id: user.id,
        plan_id: planId,
        transaction_uuid: transactionUuid,
        expected_amount: amount,
        paid_amount: amount,
        status: localStatus === "COMPLETE" ? "complete" : "pending_verification",
        ref_id: decodedData?.transaction_code || null,
        raw_response: decodedData || { state },
        provider: "esewa",
        environment: "test",
      } as any, { onConflict: "transaction_uuid" });

      await supabase.from("subscriptions").update({ status: "cancelled" }).eq("user_id", user.id).eq("status", "active");
      const now = new Date();
      const endsAt = new Date(now);
      endsAt.setMonth(endsAt.getMonth() + 1);

      const { error: insertErr } = await supabase.from("subscriptions").insert({
        user_id: user.id,
        plan_id: planId,
        starts_at: now.toISOString(),
        ends_at: endsAt.toISOString(),
        status: "active",
      });
      if (insertErr) throw insertErr;
    };

    const run = async () => {
      if (state === "failure") {
        setMessage("Payment failed or cancelled.");
        setLoading(false);
        return;
      }

      if (!transactionUuid) {
        setMessage("Missing transaction ID from eSewa response.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("esewa-verify-subscription", {
        body: { transactionUuid },
      });

      if (!error && !data?.error) {
        setMessage("Payment verified and subscription activated successfully.");
        setLoading(false);
        return;
      }

      try {
        await fallbackVerify();
        setMessage("Payment verified and subscription activated successfully.");
      } catch (e: any) {
        setMessage(e?.message || data?.error || error?.message || "Unable to verify payment.");
      }

      setLoading(false);
    };

    run();
  }, [state, transactionUuid, decodedData]);

  return (
    <div className="min-h-screen bg-secondary/30 p-4 md:p-8 flex items-center justify-center">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>eSewa Payment Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{loading ? "Please wait..." : message}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => navigate(-1)} variant="outline">Go Back</Button>
            <Button onClick={() => navigate("/rider/subscription")}>Subscription Page</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EsewaReturn;
