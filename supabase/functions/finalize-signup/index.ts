import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SignupRole = "rider" | "rider_partner" | "driver" | "auto_driver" | "restaurant" | "garage";
type BaseRole = "rider" | "driver" | "restaurant" | "garage" | "admin" | "bus_operator";

interface DriverProfilePayload {
  vehicleType: string;
  vehicleBrand: string;
  licenseNumber: string;
  availability: string;
  nationalIdUrl?: string | null;
  vehicleRegistrationUrl?: string | null;
  profilePhotoUrl?: string | null;
  vehiclePhotoUrl?: string | null;
}

interface RestaurantPayload {
  name: string;
  address: string;
  cuisineType?: string | null;
  openingTime: string;
  closingTime: string;
  imageUrl?: string | null;
  businessLicenseUrl?: string | null;
}

interface GaragePayload {
  name: string;
  address: string;
  description?: string | null;
  imageUrl?: string | null;
}

interface FinalizeSignupPayload {
  fullName: string;
  phone: string;
  city?: string | null;
  avatarUrl?: string | null;
  driverProfile?: DriverProfilePayload;
  restaurant?: RestaurantPayload;
  garage?: GaragePayload;
}

const normalizeText = (value: string | null | undefined) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length > 0 ? normalized : null;
};

const normalizeVehicleType = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "bike") return "Bike";
  if (normalized === "scooter") return "Scooter";
  if (normalized === "auto") return "Auto";
  if (normalized === "car") return "Car";
  if (normalized === "van") return "Van";
  if (normalized === "truck") return "Truck";
  return value.trim();
};

const normalizeRoleValue = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const normalizeRequestedRole = (
  rawRole: unknown,
  rawRequestedRole: unknown,
): SignupRole | BaseRole => {
  const requestedRole = normalizeRoleValue(rawRequestedRole);
  const role = normalizeRoleValue(rawRole);

  if (requestedRole === "user") return "rider";
  if (["rider_partner", "auto_driver", "rider", "driver", "restaurant", "garage", "admin", "bus_operator"].includes(requestedRole)) {
    return requestedRole as SignupRole | BaseRole;
  }

  if (role === "user") return "rider";
  if (["rider_partner", "auto_driver", "rider", "driver", "restaurant", "garage", "admin", "bus_operator"].includes(role)) {
    return role as SignupRole | BaseRole;
  }

  return "rider";
};

const normalizeBaseRole = (rawRole: unknown, rawRequestedRole: unknown): BaseRole => {
  const role = normalizeRoleValue(rawRole);
  const requestedRole = normalizeRequestedRole(rawRole, rawRequestedRole);

  if (role === "user") return "rider";
  if (role === "rider_partner" || role === "auto_driver") return "driver";
  if (["rider", "driver", "restaurant", "garage", "admin", "bus_operator"].includes(role)) {
    return role as BaseRole;
  }

  if (requestedRole === "rider_partner" || requestedRole === "auto_driver") {
    return "driver";
  }

  if (["rider", "driver", "restaurant", "garage", "admin", "bus_operator"].includes(requestedRole)) {
    return requestedRole as BaseRole;
  }

  return "rider";
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
    const user = authData.user;

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!user.email_confirmed_at) {
      throw new Error("Email address has not been verified yet");
    }

    const payload = (await req.json()) as FinalizeSignupPayload;
    const requestedRole = normalizeRequestedRole(
      user.user_metadata?.role,
      user.user_metadata?.requested_role,
    );
    const baseRole = normalizeBaseRole(
      user.user_metadata?.role,
      user.user_metadata?.requested_role,
    );

    if (!["rider", "driver", "restaurant", "garage"].includes(baseRole)) {
      throw new Error("Unsupported signup role");
    }

    if (
      user.user_metadata?.role !== baseRole
      || user.user_metadata?.requested_role !== requestedRole
    ) {
      const { error: metadataError } = await adminClient.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          role: baseRole,
          requested_role: requestedRole,
        },
      });

      if (metadataError) {
        throw metadataError;
      }
    }

    const fullName = normalizeText(payload.fullName) || normalizeText(String(user.user_metadata?.full_name || "")) || "";
    const phone = normalizeText(payload.phone);
    const city = normalizeText(payload.city);
    const accountStatus = baseRole === "rider" ? "approved" : "pending";
    const avatarUrl = normalizeText(payload.avatarUrl) || normalizeText(payload.driverProfile?.profilePhotoUrl);

    const { error: profileError } = await adminClient
      .from("profiles")
      .update({
        full_name: fullName,
        phone,
        city,
        account_status: accountStatus,
        avatar_url: avatarUrl,
      } as any)
      .eq("id", user.id);

    if (profileError) {
      throw profileError;
    }

    const customRoleSlug =
      requestedRole === "auto_driver"
        ? "auto_driver"
        : requestedRole === "rider_partner"
          ? "rider_partner"
          : null;

    if (customRoleSlug) {
      const { data: existingCustomRole, error: customRoleError } = await adminClient
        .from("user_custom_roles" as any)
        .select("user_id")
        .eq("user_id", user.id)
        .eq("role_slug", customRoleSlug)
        .limit(1);

      if (customRoleError) {
        throw customRoleError;
      }

      if (!existingCustomRole || existingCustomRole.length === 0) {
        const { error } = await adminClient
          .from("user_custom_roles" as any)
          .insert({ user_id: user.id, role_slug: customRoleSlug } as any);

        if (error) {
          throw error;
        }
      }
    }

    if (baseRole === "driver") {
      const driverProfile = payload.driverProfile;
      if (!driverProfile) {
        throw new Error("Driver profile data is required");
      }

      const normalizedVehicleType = normalizeVehicleType(driverProfile.vehicleType);

      if (requestedRole === "rider_partner" && !["Bike", "Scooter"].includes(normalizedVehicleType)) {
        throw new Error("Rider signup only supports bike or scooter vehicles");
      }

      if (requestedRole === "driver" && !["Auto", "Car", "Van", "Truck"].includes(normalizedVehicleType)) {
        throw new Error("Driver signup only supports auto, car, van, or truck vehicles");
      }

      if (requestedRole === "auto_driver" && normalizedVehicleType !== "Auto") {
        throw new Error("Auto driver signup only supports auto vehicles");
      }

      const { error } = await adminClient.from("driver_profiles").upsert(
        {
          id: user.id,
          vehicle_type: normalizedVehicleType,
          vehicle_brand: driverProfile.vehicleBrand,
          license_number: driverProfile.licenseNumber,
          availability: driverProfile.availability,
          national_id_url: normalizeText(driverProfile.nationalIdUrl),
          vehicle_registration_url: normalizeText(driverProfile.vehicleRegistrationUrl),
          profile_photo_url: normalizeText(driverProfile.profilePhotoUrl),
          vehicle_photo_url: normalizeText(driverProfile.vehiclePhotoUrl),
        } as any,
        { onConflict: "id" },
      );

      if (error) {
        throw error;
      }
    }

    if (baseRole === "restaurant") {
      const restaurant = payload.restaurant;
      if (!restaurant) {
        throw new Error("Restaurant profile data is required");
      }

      const restaurantPayload = {
        name: restaurant.name.trim(),
        address: restaurant.address.trim(),
        phone,
        cuisine_type: normalizeText(restaurant.cuisineType),
        opening_time: restaurant.openingTime,
        closing_time: restaurant.closingTime,
        image_url: normalizeText(restaurant.imageUrl),
        business_license_url: normalizeText(restaurant.businessLicenseUrl),
      } as any;

      const { data: existingRows, error: existingError } = await adminClient
        .from("restaurants")
        .select("id")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1);

      if (existingError) {
        throw existingError;
      }

      const existingId = existingRows?.[0]?.id;
      const response = existingId
        ? await adminClient.from("restaurants").update(restaurantPayload).eq("id", existingId)
        : await adminClient.from("restaurants").insert({ owner_id: user.id, ...restaurantPayload });

      if (response.error) {
        throw response.error;
      }
    }

    if (baseRole === "garage") {
      const garage = payload.garage;
      if (!garage) {
        throw new Error("Garage profile data is required");
      }

      const garagePayload = {
        name: garage.name.trim(),
        address: garage.address.trim(),
        phone,
        description: normalizeText(garage.description),
        image_url: normalizeText(garage.imageUrl),
      } as any;

      const { data: existingRows, error: existingError } = await adminClient
        .from("garages")
        .select("id")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1);

      if (existingError) {
        throw existingError;
      }

      const existingId = existingRows?.[0]?.id;
      const response = existingId
        ? await (adminClient as any).from("garages").update(garagePayload).eq("id", existingId)
        : await (adminClient as any).from("garages").insert({ owner_id: user.id, ...garagePayload });

      if (response.error) {
        throw response.error;
      }
    }

    return new Response(
      JSON.stringify({
        role: requestedRole,
        accountStatus,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
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
