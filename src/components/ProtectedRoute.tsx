import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscriptionCheck } from "@/hooks/useSubscriptionCheck";
import { supabase } from "@/integrations/supabase/client";
import { rolePathMap } from "@/components/dashboard/sidebarConfig";
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
  const [requireBusOperatorSubscription, setRequireBusOperatorSubscription] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    const loadSettings = async (showLoading = false) => {
      if (showLoading && isActive) {
        setSettingsLoading(true);
      }

      try {
        const { data } = await supabase
          .from("app_settings" as any)
          .select("key, value_bool")
          .in("key", ["require_rider_subscription", "require_bus_operator_subscription"]);

        if (!isActive) return;

        const settings = new Map(
          (((data as any[]) || [])).map((row) => [row.key, Boolean(row.value_bool)]),
        );

        setRequireRiderSubscription(settings.get("require_rider_subscription") ?? false);
        setRequireBusOperatorSubscription(settings.get("require_bus_operator_subscription") ?? true);
      } finally {
        if (showLoading && isActive) {
          setSettingsLoading(false);
        }
      }
    };

    void loadSettings(true);

    const handleFocus = () => {
      void loadSettings(false);
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      isActive = false;
      window.removeEventListener("focus", handleFocus);
    };
  }, [location.pathname]);

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
  // Rider(User) and Bus Operator subscription are controlled by admin settings.
  const shouldEnforceSubscription =
    !!requiredRole &&
    requiredRole !== "admin" &&
    (
      requiredRole === "rider"
        ? requireRiderSubscription
        : requiredRole === "bus_operator"
          ? requireBusOperatorSubscription
          : true
    );

  if (shouldEnforceSubscription) {
    const basePath = rolePathMap[requiredRole];

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
      basePath,
      `${basePath}/subscription`,
      `${basePath}/profile`,
      `${basePath}/notifications`,
      `${basePath}/support`,
    ]);

    if (!hasActiveSubscription && !allowedWithoutSub.has(location.pathname)) {
      return <Navigate to={`${basePath}/subscription`} replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
