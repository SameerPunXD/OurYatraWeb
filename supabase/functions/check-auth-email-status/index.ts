import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const findUserByEmail = async (email: string) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const matchedUser = (data.users || []).find(
      (user) => (user.email || "").toLowerCase() === email,
    );

    if (matchedUser) {
      const userId = matchedUser.id;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        adminClient.from("profiles").select("account_status").eq("id", userId).maybeSingle(),
        adminClient.from("user_roles").select("role").eq("user_id", userId),
      ]);

      return {
        exists: true,
        userId,
        emailConfirmed: Boolean(matchedUser.email_confirmed_at),
        roles: (roles || []).map((roleRow) => roleRow.role),
        accountStatus: profile?.account_status || null,
      };
    }

    const lastPage = data.lastPage || 0;
    if (lastPage === 0 || page >= lastPage) break;
    page += 1;
  }

  return {
    exists: false,
    userId: null,
    emailConfirmed: false,
    roles: [],
    accountStatus: null,
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      throw new Error("Email is required");
    }

    const result = await findUserByEmail(normalizedEmail);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
