import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: userData, error: authError } = await authClient.auth.getUser();
    if (authError || !userData.user) throw new Error("Unauthorized");

    const { transactionUuid } = await req.json();
    if (!transactionUuid) throw new Error("transactionUuid is required");

    const adminClient = createClient(supabaseUrl, supabaseServiceRole);

    const { data: payment, error: paymentErr } = await adminClient
      .from("subscription_payments")
      .select("*")
      .eq("transaction_uuid", transactionUuid)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (paymentErr || !payment) throw new Error("Payment record not found");

    if (payment.status === "complete") {
      return new Response(JSON.stringify({ ok: true, status: "COMPLETE", alreadyProcessed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const envMode = (payment.environment || "test").toLowerCase();
    const statusBase = envMode === "production"
      ? "https://esewa.com.np/api/epay/transaction/status/"
      : "https://rc.esewa.com.np/api/epay/transaction/status/";

    const productCode = Deno.env.get("ESEWA_PRODUCT_CODE") || "EPAYTEST";
    const url = `${statusBase}?product_code=${encodeURIComponent(productCode)}&total_amount=${encodeURIComponent(payment.expected_amount)}&transaction_uuid=${encodeURIComponent(payment.transaction_uuid)}`;

    const esewaRes = await fetch(url, { method: "GET" });
    const esewaData = await esewaRes.json();
    const status = (esewaData?.status || "UNKNOWN").toUpperCase();

    await adminClient
      .from("subscription_payments")
      .update({
        status: status.toLowerCase(),
        paid_amount: Number(esewaData?.total_amount || payment.expected_amount),
        ref_id: esewaData?.ref_id || null,
        raw_response: esewaData,
      })
      .eq("id", payment.id);

    if (status !== "COMPLETE") {
      throw new Error(`Payment not completed (status: ${status})`);
    }

    const now = new Date();
    const endsAt = new Date(now);
    endsAt.setMonth(endsAt.getMonth() + 1);

    await adminClient
      .from("subscriptions")
      .update({ status: "cancelled" })
      .eq("user_id", userData.user.id)
      .eq("status", "active");

    const { error: subErr } = await adminClient.from("subscriptions").insert({
      user_id: userData.user.id,
      plan_id: payment.plan_id,
      starts_at: now.toISOString(),
      ends_at: endsAt.toISOString(),
      status: "active",
    });

    if (subErr) throw subErr;

    return new Response(JSON.stringify({ ok: true, status: "COMPLETE", refId: esewaData?.ref_id || null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
