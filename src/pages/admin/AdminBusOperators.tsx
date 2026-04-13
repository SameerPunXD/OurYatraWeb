import { useEffect, useMemo, useState } from "react";
import { Bus, CreditCard, Plus, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const getFunctionErrorMessage = async (error: unknown) => {
  const fallback = error instanceof Error ? error.message : "Something went wrong";
  const response = (error as { context?: Response } | null)?.context;

  if (!response) {
    return fallback;
  }

  try {
    const payload = await response.clone().json();
    if (typeof payload?.error === "string" && payload.error.trim().length > 0) {
      return payload.error;
    }
    if (typeof payload?.message === "string" && payload.message.trim().length > 0) {
      return payload.message;
    }
  } catch {
    // Fall through to text parsing.
  }

  try {
    const text = await response.clone().text();
    if (text.trim().length > 0) {
      return text;
    }
  } catch {
    // Fall back to the generic client error message.
  }

  return fallback;
};

const DEFAULT_BUS_OPERATOR_PLAN_NAME = "Bus Operator Monthly";
const DEFAULT_BUS_OPERATOR_PLAN_PRICE = "4000";
const DEFAULT_BUS_OPERATOR_PLAN_FEATURES = [
  "List unlimited bus routes",
  "Seat management",
  "Booking dashboard",
  "Passenger notifications",
  "Priority support",
];

const AdminBusOperators = () => {
  const { toast } = useToast();
  const [operators, setOperators] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [subscriptionSaving, setSubscriptionSaving] = useState(false);
  const [requireBusOperatorSubscription, setRequireBusOperatorSubscription] = useState(true);
  const [busOperatorPlanId, setBusOperatorPlanId] = useState<string | null>(null);
  const [busOperatorPlanPrice, setBusOperatorPlanPrice] = useState(DEFAULT_BUS_OPERATOR_PLAN_PRICE);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    city: "",
  });

  const fetchOperators = async () => {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "bus_operator");

    const userIds = (roles || []).map((role) => role.user_id);
    if (userIds.length === 0) {
      setOperators([]);
      setLoading(false);
      return;
    }

    const [profilesRes, busesRes, bookingsRes] = await Promise.all([
      supabase.from("profiles").select("*").in("id", userIds).order("created_at", { ascending: false }),
      supabase.from("buses").select("id, operator_id, status").in("operator_id", userIds),
      supabase.from("bus_bookings").select("id, bus_id, status"),
    ]);

    const buses = busesRes.data || [];
    const bookings = bookingsRes.data || [];
    const busesByOperator = buses.reduce<Record<string, { total: number; active: number; busIds: string[] }>>((acc, bus) => {
      if (!acc[bus.operator_id]) {
        acc[bus.operator_id] = { total: 0, active: 0, busIds: [] };
      }
      acc[bus.operator_id].total += 1;
      if (bus.status === "active") acc[bus.operator_id].active += 1;
      acc[bus.operator_id].busIds.push(bus.id);
      return acc;
    }, {});

    const bookingsByBus = bookings.reduce<Record<string, number>>((acc, booking) => {
      if (booking.status === "cancelled") return acc;
      acc[booking.bus_id] = (acc[booking.bus_id] || 0) + 1;
      return acc;
    }, {});

    const rows = (profilesRes.data || []).map((profile) => {
      const summary = busesByOperator[profile.id] || { total: 0, active: 0, busIds: [] };
      const totalBookings = summary.busIds.reduce((sum, busId) => sum + (bookingsByBus[busId] || 0), 0);
      return {
        ...profile,
        totalBuses: summary.total,
        activeBuses: summary.active,
        totalBookings,
      };
    });

    setOperators(rows);
    setLoading(false);
  };

  const loadSubscriptionSettings = async () => {
    const [settingsRes, planRes] = await Promise.all([
      supabase
        .from("app_settings" as any)
        .select("value_bool")
        .eq("key", "require_bus_operator_subscription")
        .maybeSingle(),
      supabase
        .from("subscription_plans")
        .select("id, name, price, is_active, features")
        .eq("role", "bus_operator")
        .is("custom_role_slug", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    if (settingsRes.error) {
      toast({
        title: "Could not load bus subscription settings",
        description: settingsRes.error.message,
        variant: "destructive",
      });
      setSubscriptionLoading(false);
      return;
    }

    if (planRes.error) {
      toast({
        title: "Could not load bus operator plan",
        description: planRes.error.message,
        variant: "destructive",
      });
      setSubscriptionLoading(false);
      return;
    }

    const plan = planRes.data;
    setRequireBusOperatorSubscription((settingsRes.data as any)?.value_bool ?? true);
    setBusOperatorPlanId(plan?.id ?? null);
    setBusOperatorPlanPrice(plan?.price ? String(plan.price) : DEFAULT_BUS_OPERATOR_PLAN_PRICE);
    setSubscriptionLoading(false);
  };

  useEffect(() => {
    fetchOperators();
    loadSubscriptionSettings();
  }, []);

  const persistSubscriptionSettings = async (
    nextRequireBusOperatorSubscription: boolean,
    nextBusOperatorPlanPrice: string,
    successDescription: string,
  ) => {
    const parsedPrice = Number(nextBusOperatorPlanPrice);

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      toast({
        title: "Invalid price",
        description: "Enter a valid monthly subscription price for bus operators.",
        variant: "destructive",
      });
      return false;
    }

    setSubscriptionSaving(true);

    const normalizedPrice = Math.round(parsedPrice);
    const { error: settingError } = await supabase.from("app_settings" as any).upsert({
      key: "require_bus_operator_subscription",
      value_bool: nextRequireBusOperatorSubscription,
    } as any);

    if (settingError) {
      toast({
        title: "Could not save subscription setting",
        description: settingError.message,
        variant: "destructive",
      });
      setSubscriptionSaving(false);
      return false;
    }

    if (busOperatorPlanId) {
      const { error: planError } = await supabase
        .from("subscription_plans")
        .update({
          price: normalizedPrice,
          is_active: nextRequireBusOperatorSubscription,
        })
        .eq("id", busOperatorPlanId);

      if (planError) {
        toast({
          title: "Could not update bus operator plan",
          description: planError.message,
          variant: "destructive",
        });
        setSubscriptionSaving(false);
        return false;
      }
    } else {
      const { data: createdPlan, error: createPlanError } = await supabase
        .from("subscription_plans")
        .insert({
          role: "bus_operator",
          name: DEFAULT_BUS_OPERATOR_PLAN_NAME,
          price: normalizedPrice,
          is_active: nextRequireBusOperatorSubscription,
          features: DEFAULT_BUS_OPERATOR_PLAN_FEATURES,
        })
        .select("id")
        .single();

      if (createPlanError) {
        toast({
          title: "Could not create bus operator plan",
          description: createPlanError.message,
          variant: "destructive",
        });
        setSubscriptionSaving(false);
        return false;
      }

      setBusOperatorPlanId(createdPlan.id);
    }

    toast({
      title: "Bus operator subscription updated",
      description: successDescription,
    });

    setBusOperatorPlanPrice(String(normalizedPrice));
    setSubscriptionSaving(false);
    loadSubscriptionSettings();
    return true;
  };

  const handleSaveSubscriptionPrice = async () => {
    const roundedPrice = Number.isFinite(Number(busOperatorPlanPrice))
      ? Math.round(Number(busOperatorPlanPrice))
      : busOperatorPlanPrice;

    await persistSubscriptionSettings(
      requireBusOperatorSubscription,
      busOperatorPlanPrice,
      requireBusOperatorSubscription
        ? `Bus operators will now see the Rs ${roundedPrice} subscription plan.`
        : "Saved the bus operator price for later while subscription is disabled.",
    );
  };

  const handleToggleBusOperatorSubscription = async (checked: boolean) => {
    const previousValue = requireBusOperatorSubscription;
    const roundedPrice = Number.isFinite(Number(busOperatorPlanPrice))
      ? Math.round(Number(busOperatorPlanPrice))
      : busOperatorPlanPrice;

    setRequireBusOperatorSubscription(checked);

    const success = await persistSubscriptionSettings(
      checked,
      busOperatorPlanPrice,
      checked
        ? `Bus operators must now subscribe before using buses and bookings. Price: Rs ${roundedPrice}.`
        : "Bus operators can now use buses and bookings without a subscription.",
    );

    if (!success) {
      setRequireBusOperatorSubscription(previousValue);
    }
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);

    try {
      const { data, error } = await supabase.functions.invoke("admin-create-bus-operator", {
        body: {
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          phone: form.phone,
          city: form.city,
        },
      });

      if (error) {
        toast({
          title: "Could not create bus operator",
          description: await getFunctionErrorMessage(error),
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Bus operator created",
        description: `${data?.email || form.email} can now sign in as a bus operator.`,
      });

      setForm({ fullName: "", email: "", password: "", phone: "", city: "" });
      fetchOperators();
    } finally {
      setCreating(false);
    }
  };

  const updateStatus = async (userId: string, status: string) => {
    const { error } = await supabase.from("profiles").update({ account_status: status } as any).eq("id", userId);
    if (error) {
      toast({ title: "Status update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Bus operator ${status}` });
    fetchOperators();
  };

  const statusSummary = useMemo(
    () => ({
      active: operators.filter((operator) => operator.account_status === "approved").length,
      blocked: operators.filter((operator) => operator.account_status === "blocked").length,
    }),
    [operators],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Bus Operators</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total Operators</p>
            <p className="mt-1 text-3xl font-bold text-foreground">{operators.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Approved</p>
            <p className="mt-1 text-3xl font-bold text-foreground">{statusSummary.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Blocked</p>
            <p className="mt-1 text-3xl font-bold text-foreground">{statusSummary.blocked}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Bus Operator Subscription</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {subscriptionLoading ? (
            <p className="text-sm text-muted-foreground">Loading bus operator subscription settings...</p>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    <p className="font-medium text-foreground">Charge subscription for bus operators</p>
                    <Badge variant={requireBusOperatorSubscription ? "secondary" : "outline"}>
                      {requireBusOperatorSubscription ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                </div>
                <Switch
                  checked={requireBusOperatorSubscription}
                  disabled={subscriptionSaving}
                  onCheckedChange={handleToggleBusOperatorSubscription}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="space-y-2">
                  <Label>Monthly Price (Rs)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={busOperatorPlanPrice}
                    disabled={subscriptionSaving}
                    onChange={(event) => setBusOperatorPlanPrice(event.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button type="button" disabled={subscriptionSaving} onClick={handleSaveSubscriptionPrice}>
                    <Save className="mr-1 h-4 w-4" />
                    {subscriptionSaving ? "Saving..." : "Save price"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Create Bus Operator Account</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreate}>
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="text" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} minLength={6} required />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={creating}>
                <Plus className="mr-1 h-4 w-4" />
                {creating ? "Creating..." : "Create operator"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Existing Bus Operators</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading operators...</p>
          ) : operators.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No bus operators found yet.
            </div>
          ) : (
            operators.map((operator) => (
              <div key={operator.id} className="rounded-lg border p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Bus className="h-4 w-4 text-primary" />
                      <p className="font-medium text-foreground">{operator.full_name || "No name"}</p>
                      <Badge variant={operator.account_status === "approved" ? "secondary" : "outline"}>
                        {operator.account_status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {operator.email || "No email"} • {operator.phone || "No phone"} • {operator.city || "No city"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Routes: {operator.totalBuses} total • {operator.activeBuses} active • {operator.totalBookings} bookings
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {operator.account_status !== "approved" && (
                      <Button size="sm" onClick={() => updateStatus(operator.id, "approved")}>
                        Approve
                      </Button>
                    )}
                    {operator.account_status !== "blocked" && (
                      <Button size="sm" variant="destructive" onClick={() => updateStatus(operator.id, "blocked")}>
                        Block
                      </Button>
                    )}
                    {operator.account_status === "blocked" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus(operator.id, "approved")}>
                        Unblock
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminBusOperators;
