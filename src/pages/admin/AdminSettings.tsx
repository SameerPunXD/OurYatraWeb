import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface Plan {
  id: string;
  name: string;
  price: number;
  role: AppRole;
  features: string[];
  is_active: boolean;
  custom_role_slug?: string | null;
}

interface CustomRole {
  id: string;
  slug: string;
  label: string;
  base_role: AppRole;
  is_active: boolean;
}

const AdminSettings = () => {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [requireUserSubscription, setRequireUserSubscription] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", price: "", role: "rider" as AppRole, features: "", isAutoDriverPlan: false, customRoleSlug: "none" });
  const [newCustomRole, setNewCustomRole] = useState({ slug: "", label: "", baseRole: "driver" as AppRole });

  const fetchPlans = async () => {
    const [plansRes, customRolesRes, settingsRes] = await Promise.all([
      supabase.from("subscription_plans").select("*").order("role").order("price"),
      supabase.from("custom_roles" as any).select("*").order("base_role").order("label"),
      supabase.from("app_settings" as any).select("value_bool").eq("key", "require_rider_subscription").maybeSingle(),
    ]);
    setPlans(((plansRes.data as any[]) || []).map(p => ({ ...p, features: Array.isArray(p.features) ? p.features as string[] : [] })));
    setCustomRoles((customRolesRes.data as any[]) || []);
    setRequireUserSubscription(Boolean((settingsRes.data as any)?.value_bool));
    setLoading(false);
  };

  useEffect(() => { fetchPlans(); }, []);

  const resetForm = () => {
    setForm({ name: "", price: "", role: "rider", features: "", isAutoDriverPlan: false, customRoleSlug: "none" });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (plan: Plan) => {
    setForm({
      name: plan.name,
      price: String(plan.price),
      role: plan.role,
      features: plan.features.join(", "),
      isAutoDriverPlan: plan.role === "driver" && plan.name.toLowerCase().includes("auto driver"),
      customRoleSlug: plan.custom_role_slug || "none",
    });
    setEditingId(plan.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const features = form.features.split(",").map(f => f.trim()).filter(Boolean);

    let planName = form.name.trim();
    if (form.role === "driver" && form.isAutoDriverPlan && !planName.toLowerCase().includes("auto driver")) {
      planName = `Auto Driver - ${planName}`;
    }

    const payload = {
      name: planName,
      price: parseInt(form.price),
      role: form.role,
      features,
      custom_role_slug: form.customRoleSlug === "none" ? null : form.customRoleSlug,
    } as any;

    if (editingId) {
      const { error } = await supabase.from("subscription_plans").update(payload).eq("id", editingId);
      if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Plan updated!" });
    } else {
      const { error } = await supabase.from("subscription_plans").insert(payload);
      if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Plan created!" });
    }
    resetForm();
    fetchPlans();
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("subscription_plans").update({ is_active: active }).eq("id", id);
    fetchPlans();
  };

  const deletePlan = async (id: string) => {
    const { error } = await supabase.from("subscription_plans").delete().eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else fetchPlans();
  };

  const createCustomRole = async (e: React.FormEvent) => {
    e.preventDefault();
    const slug = newCustomRole.slug.trim().toLowerCase().replace(/[^a-z0-9_\-]/g, "_");
    if (!slug || !newCustomRole.label.trim()) {
      toast({ title: "Missing fields", description: "Slug and label are required.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("custom_roles" as any).insert({
      slug,
      label: newCustomRole.label.trim(),
      base_role: newCustomRole.baseRole,
      is_active: true,
    } as any);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Custom role created" });
    setNewCustomRole({ slug: "", label: "", baseRole: "driver" });
    fetchPlans();
  };

  const toggleRequireUserSubscription = async (enabled: boolean) => {
    setRequireUserSubscription(enabled);
    const { error } = await supabase.from("app_settings" as any).upsert({
      key: "require_rider_subscription",
      value_bool: enabled,
    } as any);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      setRequireUserSubscription(!enabled);
      return;
    }
    toast({ title: `User subscription ${enabled ? "enabled" : "disabled"}` });
  };

  const roleColors: Record<string, string> = {
    rider: "bg-blue-100 text-blue-800",
    driver: "bg-green-100 text-green-800",
    restaurant: "bg-orange-100 text-orange-800",
    garage: "bg-amber-100 text-amber-800",
    admin: "bg-purple-100 text-purple-800",
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Settings</h2>

      <Card>
        <CardHeader><CardTitle className="text-base">Platform Settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Require subscription for Users</Label>
            <Switch checked={requireUserSubscription} onCheckedChange={toggleRequireUserSubscription} />
          </div>
          <p className="text-xs text-muted-foreground">If off, User (rider) can use services without buying subscription.</p>
          <div className="flex items-center justify-between">
            <Label>Allow new signups</Label>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <Label>Maintenance mode</Label>
            <Switch />
          </div>
          <div className="flex items-center justify-between">
            <Label>Email notifications</Label>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Custom Role Management */}
      <Card>
        <CardHeader><CardTitle className="text-base">Custom Roles</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={createCustomRole} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Input placeholder="slug (e.g. auto_driver)" value={newCustomRole.slug} onChange={e => setNewCustomRole(v => ({ ...v, slug: e.target.value }))} />
            <Input placeholder="label (e.g. Auto Driver)" value={newCustomRole.label} onChange={e => setNewCustomRole(v => ({ ...v, label: e.target.value }))} />
            <Select value={newCustomRole.baseRole} onValueChange={v => setNewCustomRole(r => ({ ...r, baseRole: v as AppRole }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rider">User</SelectItem>
                <SelectItem value="driver">Driver</SelectItem>
                <SelectItem value="restaurant">Restaurant</SelectItem>
                <SelectItem value="garage">Garage</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit"><Plus className="h-4 w-4 mr-1" />Create Role</Button>
          </form>

          <div className="space-y-2">
            {customRoles.map(cr => (
              <div key={cr.id} className="p-2 border rounded-md flex items-center justify-between">
                <div className="text-sm">
                  <span className="font-medium">{cr.label}</span>
                  <span className="text-muted-foreground"> ({cr.slug}) • base: {cr.base_role}</span>
                </div>
                <Badge variant={cr.is_active ? "default" : "outline"}>{cr.is_active ? "active" : "inactive"}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Subscription Plan Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Subscription Plans</CardTitle>
            <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Add Plan
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showForm && (
            <form onSubmit={handleSubmit} className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Plan Name</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Basic" required />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Price (Rs/month)</Label>
                  <Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Role</Label>
                  <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as AppRole }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rider">User</SelectItem>
                      <SelectItem value="driver">Driver</SelectItem>
                      <SelectItem value="restaurant">Restaurant</SelectItem>
                      <SelectItem value="garage">Garage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Features (comma separated)</Label>
                  <Input value={form.features} onChange={e => setForm(f => ({ ...f, features: e.target.value }))} placeholder="Feature 1, Feature 2" />
                </div>
                {form.role === "driver" && (
                  <>
                    <div className="col-span-2 flex items-center justify-between rounded-md border p-2">
                      <Label className="text-xs">This is an Auto Driver package</Label>
                      <Switch checked={form.isAutoDriverPlan} onCheckedChange={v => setForm(f => ({ ...f, isAutoDriverPlan: v }))} />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs">Custom role audience (optional)</Label>
                      <Select value={form.customRoleSlug} onValueChange={v => setForm(f => ({ ...f, customRoleSlug: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select custom role" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None (all drivers)</SelectItem>
                          {customRoles.filter(cr => cr.base_role === "driver" && cr.is_active).map(cr => (
                            <SelectItem key={cr.slug} value={cr.slug}>{cr.label} ({cr.slug})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm"><Check className="h-3 w-3 mr-1" />{editingId ? "Update" : "Create"}</Button>
                <Button type="button" size="sm" variant="outline" onClick={resetForm}><X className="h-3 w-3 mr-1" />Cancel</Button>
              </div>
            </form>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : plans.length === 0 ? (
            <p className="text-sm text-muted-foreground">No subscription plans yet. Create one above.</p>
          ) : (
            <div className="space-y-2">
              {plans.map(plan => (
                <div key={plan.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{plan.name}</span>
                      <Badge className={roleColors[plan.role]}>{plan.role}</Badge>
                      {!plan.is_active && <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>}
                    </div>
                    <p className="text-sm font-semibold text-primary">Rs {plan.price}/month</p>
                    {plan.features.length > 0 && (
                      <p className="text-xs text-muted-foreground">{plan.features.join(" · ")}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={plan.is_active} onCheckedChange={v => toggleActive(plan.id, v)} />
                    <Button size="icon" variant="ghost" onClick={() => startEdit(plan)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deletePlan(plan.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSettings;
