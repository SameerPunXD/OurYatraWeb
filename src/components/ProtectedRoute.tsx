import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscriptionCheck } from "@/hooks/useSubscriptionCheck";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: AppRole;
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, roles, profile, loading } = useAuth();
  const { hasActiveSubscription, loading: subscriptionLoading } = useSubscriptionCheck();
  const location = useLocation();
  const [requireRiderSubscription, setRequireRiderSubscription] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      const { data } = await supabase
        .from("app_settings" as any)
        .select("value_bool")
        .eq("key", "require_rider_subscription")
        .maybeSingle();
      setRequireRiderSubscription(Boolean((data as any)?.value_bool));
      setSettingsLoading(false);
    };
    loadSettings();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Check account status
  if (profile && (profile as any).account_status && (profile as any).account_status !== "approved") {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && !roles.includes(requiredRole)) {
    return <Navigate to="/" replace />;
  }

  // Driver/restaurant/garage users must have an active subscription.
  // Rider(User) subscription is controlled by admin setting.
  const shouldEnforceSubscription =
    !!requiredRole &&
    requiredRole !== "admin" &&
    (requiredRole !== "rider" || requireRiderSubscription);

  if (shouldEnforceSubscription) {
    if (subscriptionLoading || settingsLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Checking subscription...</p>
          </div>
        </div>
      );
    }

    const allowedWithoutSub = new Set([
      `/${requiredRole}`,
      `/${requiredRole}/subscription`,
      `/${requiredRole}/profile`,
      `/${requiredRole}/notifications`,
      `/${requiredRole}/support`,
    ]);

    if (!hasActiveSubscription && !allowedWithoutSub.has(location.pathname)) {
      return <Navigate to={`/${requiredRole}/subscription`} replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
