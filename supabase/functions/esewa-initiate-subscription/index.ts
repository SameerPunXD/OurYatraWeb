import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const toBase64Hmac = async (message: string, secret: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
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

    const { planId, origin } = await req.json();
    if (!planId) throw new Error("planId is required");

    const adminClient = createClient(supabaseUrl, supabaseServiceRole);

    const { data: plan, error: planErr } = await adminClient
      .from("subscription_plans")
      .select("id, price, is_active")
      .eq("id", planId)
      .maybeSingle();

    if (planErr || !plan || !plan.is_active) throw new Error("Plan not available");

    const amount = Number(plan.price);
    const transactionUuid = `${plan.id}-${Date.now()}`;

    const envMode = (Deno.env.get("ESEWA_ENV") || "test").toLowerCase();
    const productCode = Deno.env.get("ESEWA_PRODUCT_CODE") || "EPAYTEST";
    const secretKey = Deno.env.get("ESEWA_SECRET_KEY") || "8gBm/:&EnhH.1/q";

    const successBase = Deno.env.get("PUBLIC_SITE_URL") || origin;
    if (!successBase) throw new Error("PUBLIC_SITE_URL (or origin) is required");

    const successUrl = `${successBase}/payment/esewa/return?state=success`;
    const failureUrl = `${successBase}/payment/esewa/return?state=failure`;

    const signedFieldNames = "total_amount,transaction_uuid,product_code";
    const message = `total_amount=${amount},transaction_uuid=${transactionUuid},product_code=${productCode}`;
    const signature = await toBase64Hmac(message, secretKey);

    const { error: paymentErr } = await adminClient.from("subscription_payments").insert({
      user_id: userData.user.id,
      plan_id: plan.id,
      transaction_uuid: transactionUuid,
      expected_amount: amount,
      status: "pending",
      environment: envMode,
      provider: "esewa",
    });
    if (paymentErr) throw paymentErr;

    const formAction = envMode === "production"
      ? "https://epay.esewa.com.np/api/epay/main/v2/form"
      : "https://rc-epay.esewa.com.np/api/epay/main/v2/form";

    return new Response(
      JSON.stringify({
        formAction,
        fields: {
          amount: amount.toString(),
          tax_amount: "0",
          total_amount: amount.toString(),
          transaction_uuid: transactionUuid,
          product_code: productCode,
          product_service_charge: "0",
          product_delivery_charge: "0",
          success_url: successUrl,
          failure_url: failureUrl,
          signed_field_names: signedFieldNames,
          signature,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
