import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateBusOperatorPayload {
  fullName: string;
  email: string;
  password: string;
  phone?: string | null;
  city?: string | null;
}

const normalizeText = (value: string | null | undefined) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length > 0 ? normalized : null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const jwt = authHeader?.replace(/^Bearer\s+/i, "");

    if (!jwt) {
      throw new Error("Missing authorization token");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: authData, error: authError } = await adminClient.auth.getUser(jwt);
    const requester = authData.user;

    if (authError || !requester) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: adminRole, error: roleError } = await adminClient
      .from("user_roles")
      .select("id")
      .eq("user_id", requester.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError) {
      throw roleError;
    }

    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json()) as CreateBusOperatorPayload;
    const fullName = normalizeText(payload.fullName);
    const email = normalizeText(payload.email)?.toLowerCase();
    const password = normalizeText(payload.password);
    const phone = normalizeText(payload.phone);
    const city = normalizeText(payload.city);

    if (!fullName || !email || !password) {
      throw new Error("Full name, email, and password are required");
    }

    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters long");
    }

    const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone,
        city,
        role: "bus_operator",
        requested_role: "bus_operator",
      },
    });

    if (createError || !createdUser.user) {
      throw createError || new Error("Could not create bus operator account");
    }

    const { error: profileError } = await adminClient.from("profiles").upsert(
      {
        id: createdUser.user.id,
        full_name: fullName,
        email,
        phone,
        city,
        account_status: "approved",
      } as any,
      { onConflict: "id" },
    );

    if (profileError) {
      await adminClient.auth.admin.deleteUser(createdUser.user.id);
      throw profileError;
    }

    const { error: roleUpsertError } = await adminClient.from("user_roles").upsert(
      {
        user_id: createdUser.user.id,
        role: "bus_operator",
      } as any,
      { onConflict: "user_id,role" },
    );

    if (roleUpsertError) {
      await adminClient.auth.admin.deleteUser(createdUser.user.id);
      throw roleUpsertError;
    }

    return new Response(
      JSON.stringify({
        userId: createdUser.user.id,
        email,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
