import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSubscriptionCheck } from "@/hooks/useSubscriptionCheck";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { rolePathMap } from "@/components/dashboard/sidebarConfig";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard } from "lucide-react";

interface SubscriptionGateProps {
  children: React.ReactNode;
  fallbackMessage?: string;
}

const SubscriptionGate = ({ children, fallbackMessage = "You need an active subscription to access this feature." }: SubscriptionGateProps) => {
  const { hasActiveSubscription, loading } = useSubscriptionCheck();
  const { activeRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const subscriptionPath = activeRole ? `${rolePathMap[activeRole]}/subscription` : "/rider/subscription";
  const [requireUserSubscription, setRequireUserSubscription] = useState(false);
  const [requireBusOperatorSubscription, setRequireBusOperatorSubscription] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      setSettingsLoading(true);
      const { data } = await supabase
        .from("app_settings" as any)
        .select("key, value_bool")
        .in("key", ["require_rider_subscription", "require_bus_operator_subscription"]);

      const settings = new Map(
        (((data as any[]) || [])).map((row) => [row.key, Boolean(row.value_bool)]),
      );

      setRequireUserSubscription(settings.get("require_rider_subscription") ?? false);
      setRequireBusOperatorSubscription(settings.get("require_bus_operator_subscription") ?? true);
      setSettingsLoading(false);
    };

    loadSettings();

    window.addEventListener("focus", loadSettings);
    return () => window.removeEventListener("focus", loadSettings);
  }, [location.pathname]);

  if (loading || settingsLoading) return null;

  const shouldRequireSubscription =
    activeRole === "rider"
      ? requireUserSubscription
      : activeRole === "bus_operator"
        ? requireBusOperatorSubscription
        : true;

  if (shouldRequireSubscription && !hasActiveSubscription) {
    return (
      <Card className="border-primary/30">
        <CardContent className="p-8 text-center space-y-4">
          <CreditCard className="h-12 w-12 mx-auto text-primary" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">Subscription Required</h3>
            <p className="text-sm text-muted-foreground mt-1">{fallbackMessage}</p>
          </div>
          <Button onClick={() => navigate(subscriptionPath)}>
            View Plans
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
};

export default SubscriptionGate;
