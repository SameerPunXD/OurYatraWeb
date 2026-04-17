import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { ensureCurrentUserRole } from "@/lib/authRoleSync";

type AppRole = Database["public"]["Enums"]["app_role"];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Database["public"]["Tables"]["profiles"]["Row"] | null;
  roles: AppRole[];
  activeRole: AppRole | null;
  setActiveRole: (role: AppRole) => void;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  roles: [],
  activeRole: null,
  setActiveRole: () => {},
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Database["public"]["Tables"]["profiles"]["Row"] | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [activeRole, setActiveRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async (userId: string) => {
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    if (profileRes.data) setProfile(profileRes.data);

    let roleRows = rolesRes.data ?? [];

    if (roleRows.length === 0) {
      try {
        await ensureCurrentUserRole();
        const { data: repairedRoles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);

        roleRows = repairedRoles ?? [];
      } catch (error) {
        console.debug("[Auth] failed to sync current user role", error);
      }
    }

    const userRoles = roleRows.map((roleRow) => roleRow.role);
    setRoles(userRoles);

    if (userRoles.length === 0) {
      setActiveRole(null);
      localStorage.removeItem("ouryatra_active_role");
      return;
    }

    const saved = localStorage.getItem("ouryatra_active_role") as AppRole | null;
    const nextRole =
      (saved && userRoles.includes(saved) ? saved : null)
      || (activeRole && userRoles.includes(activeRole) ? activeRole : null)
      || (userRoles.includes("admin") ? "admin" : userRoles[0]);

    if (nextRole !== activeRole) {
      setActiveRole(nextRole);
      localStorage.setItem("ouryatra_active_role", nextRole);
    }
  }, [activeRole]);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchUserData(user.id);
  }, [fetchUserData, user]);

  const handleSetActiveRole = (role: AppRole) => {
    setActiveRole(role);
    localStorage.setItem("ouryatra_active_role", role);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchUserData(session.user.id), 0);
        } else {
          setProfile(null);
          setRoles([]);
          setActiveRole(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchUserData]);

  const signOut = async () => {
    if (user && (roles.includes("driver") || activeRole === "driver")) {
      try {
        const rpc = supabase.rpc as unknown as (
          fn: string,
        ) => Promise<{ data: unknown; error: unknown }>;
        await rpc("remove_driver_from_pending_rides");
      } catch (error) {
        console.debug("[Auth] failed to remove driver from pending rides during sign-out", error);
      }

      try {
        await supabase
          .from("driver_profiles")
          .update({ is_online: false })
          .eq("id", user.id);
      } catch (error) {
        console.debug("[Auth] failed to set driver offline during sign-out", error);
      }
    }

    await supabase.auth.signOut();
    localStorage.removeItem("ouryatra_active_role");
    setProfile(null);
    setRoles([]);
    setActiveRole(null);
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, session, profile, roles, activeRole, setActiveRole: handleSetActiveRole, loading, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
};
