import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

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

  const fetchUserData = async (userId: string) => {
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    if (profileRes.data) setProfile(profileRes.data);
    if (rolesRes.data) {
      const userRoles = rolesRes.data.map((r) => r.role);
      setRoles(userRoles);
      if (!activeRole && userRoles.length > 0) {
        const saved = localStorage.getItem("ouryatra_active_role") as AppRole | null;
        // Prioritize admin role if user has it
        const defaultRole = userRoles.includes("admin") ? "admin" : userRoles[0];
        setActiveRole(saved && userRoles.includes(saved) ? saved : defaultRole);
      }
    }
  };

  const refreshProfile = useCallback(async () => {
    if (user) await fetchUserData(user.id);
  }, [user]);

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
  }, []);

  const signOut = async () => {
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
