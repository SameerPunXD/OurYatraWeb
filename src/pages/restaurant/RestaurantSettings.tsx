import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Upload, Save, UtensilsCrossed } from "lucide-react";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const RestaurantSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", address: "", phone: "", cuisine_type: "", is_open: false,
  });
  const [hours, setHours] = useState<Record<string, { open: string; close: string; enabled: boolean }>>({});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase.from("restaurants").select("*").eq("owner_id", user.id).maybeSingle();
      if (data) {
        setRestaurant(data);
        setForm({
          name: data.name || "", description: data.description || "", address: data.address || "",
          phone: data.phone || "", cuisine_type: data.cuisine_type || "", is_open: data.is_open,
        });
        setLogoPreview(data.image_url || null);
        const oh = (data as any).opening_hours || {};
        const parsed: Record<string, { open: string; close: string; enabled: boolean }> = {};
        DAYS.forEach((d) => {
          parsed[d] = oh[d] ? { open: oh[d].open || "09:00", close: oh[d].close || "21:00", enabled: true }
            : { open: "09:00", close: "21:00", enabled: false };
        });
        setHours(parsed);
      } else {
        setIsNew(true);
        const defaultHours: Record<string, { open: string; close: string; enabled: boolean }> = {};
        DAYS.forEach((d) => { defaultHours[d] = { open: "09:00", close: "21:00", enabled: true }; });
        setHours(defaultHours);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    let imageUrl = logoPreview;
    if (logoFile) {
      const ext = logoFile.name.split(".").pop();
      const path = `restaurant/${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("uploads").upload(path, logoFile);
      if (error) { toast({ title: "Upload failed", description: error.message, variant: "destructive" }); setSaving(false); return; }
      imageUrl = supabase.storage.from("uploads").getPublicUrl(path).data.publicUrl;
    }

    const openingHours: Record<string, { open: string; close: string }> = {};
    DAYS.forEach((d) => {
      if (hours[d]?.enabled) openingHours[d] = { open: hours[d].open, close: hours[d].close };
    });

    const payload = {
      name: form.name,
      description: form.description || null,
      address: form.address,
      phone: form.phone || null,
      cuisine_type: form.cuisine_type || null,
      is_open: form.is_open,
      image_url: imageUrl,
      opening_hours: openingHours,
    };

    if (isNew) {
      const { error } = await supabase.from("restaurants").insert({ ...payload, owner_id: user.id });
      if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); setSaving(false); return; }
      toast({ title: "Restaurant created!" });
      setIsNew(false);
    } else {
      const { error } = await supabase.from("restaurants").update(payload).eq("id", restaurant.id);
      if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); setSaving(false); return; }
      toast({ title: "Settings saved!" });
    }
    setSaving(false);

    // Reload
    const { data } = await supabase.from("restaurants").select("*").eq("owner_id", user.id).maybeSingle();
    if (data) setRestaurant(data);
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-2xl font-bold text-foreground">{isNew ? "Set Up Your Restaurant" : "Restaurant Settings"}</h2>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Profile */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg">Restaurant Profile</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="h-20 w-20 rounded-lg object-cover border border-border" />
              ) : (
                <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center">
                  <UtensilsCrossed className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1" /> Upload Logo
              </Button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Restaurant Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
              <div className="space-y-2"><Label>Cuisine Type</Label><Input placeholder="e.g. Nepali, Indian" value={form.cuisine_type} onChange={e => setForm(f => ({ ...f, cuisine_type: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} required /></div>
            </div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_open} onCheckedChange={(v) => setForm(f => ({ ...f, is_open: v }))} />
              <Label>{form.is_open ? "Open for orders" : "Closed"}</Label>
            </div>
          </CardContent>
        </Card>

        {/* Business Hours */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg">Business Hours</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {DAYS.map((day) => (
              <div key={day} className="flex items-center gap-3">
                <Switch checked={hours[day]?.enabled} onCheckedChange={(v) => setHours(h => ({ ...h, [day]: { ...h[day], enabled: v } }))} />
                <span className="w-24 text-sm capitalize text-foreground">{day}</span>
                {hours[day]?.enabled ? (
                  <div className="flex items-center gap-2">
                    <Input type="time" className="w-32" value={hours[day]?.open} onChange={e => setHours(h => ({ ...h, [day]: { ...h[day], open: e.target.value } }))} />
                    <span className="text-muted-foreground">to</span>
                    <Input type="time" className="w-32" value={hours[day]?.close} onChange={e => setHours(h => ({ ...h, [day]: { ...h[day], close: e.target.value } }))} />
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Closed</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Button type="submit" disabled={saving} className="w-full sm:w-auto">
          <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save Settings"}
        </Button>
      </form>
    </div>
  );
};

export default RestaurantSettings;
