import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface EnsureCurrentUserRoleResult {
  ensured_role: AppRole | null;
  role_was_inserted: boolean;
}

export const ensureCurrentUserRole = async (): Promise<AppRole | null> => {
  const rpc = supabase.rpc as unknown as (
    fn: string,
  ) => Promise<{ data: unknown; error: unknown }>;
  const { data, error } = await rpc("ensure_current_user_role");

  if (error) {
    throw error;
  }

  const result = Array.isArray(data) ? data[0] : data;
  return (result as EnsureCurrentUserRoleResult | null)?.ensured_role ?? null;
};
