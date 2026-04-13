import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const enabled = (Deno.env.get("ALLOW_DEV_SIGNUP_FALLBACK") || "false").toLowerCase() === "true";
    if (!enabled) throw new Error("Fallback signup is disabled");

    const { email, password, meta } = await req.json();
    if (!email || !password) throw new Error("email and password are required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceRole);

    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: meta || {},
    });

    if (error) throw error;

    const userId = data.user?.id;
    if (!userId) throw new Error("User creation failed");

    const role = String(meta?.role || "rider");
    const requestedRole = String((meta as any)?.requested_role || role);
    const fullName = String(meta?.full_name || "");
    const phone = meta?.phone ? String(meta.phone) : null;
    const city = meta?.city ? String(meta.city) : null;

    // Ensure profile has core fields
    await adminClient.from("profiles").update({
      full_name: fullName,
      phone,
      city,
      account_status: role === "rider" ? "approved" : "pending",
      email,
    } as any).eq("id", userId);

    // Ensure role-specific row exists for admin dashboards
    if (role === "restaurant") {
      await adminClient.from("restaurants").insert({
        owner_id: userId,
        name: fullName ? `${fullName} Restaurant` : "New Restaurant",
        address: city || "Address pending",
        phone,
        is_open: false,
      } as any);
    }

    if (role === "garage") {
      await adminClient.from("garages").insert({
        owner_id: userId,
        name: fullName ? `${fullName} Garage` : "New Garage",
        address: city || "Address pending",
        phone,
        is_open: false,
      } as any);
    }

    if (role === "driver") {
      const vehicleType = requestedRole === "auto_driver"
        ? "Auto"
        : requestedRole === "rider_partner"
          ? "Bike"
          : "Car";

      const vehicleBrand = requestedRole === "auto_driver"
        ? "Bajaj"
        : requestedRole === "rider_partner"
          ? "Honda"
          : "Toyota";

      await adminClient.from("driver_profiles").insert({
        id: userId,
        vehicle_type: vehicleType,
        vehicle_brand: vehicleBrand,
        availability: "both",
      } as any);

      if (requestedRole === "auto_driver" || requestedRole === "rider_partner") {
        await adminClient.from("user_custom_roles").insert({
          user_id: userId,
          role_slug: requestedRole,
        } as any);
      }
    }

    return new Response(JSON.stringify({ userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
