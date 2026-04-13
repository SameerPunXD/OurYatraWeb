import { useEffect, useState } from "react";
import { MapPin, Plus, Pencil, Trash2, Home, Briefcase } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface SavedAddress {
  id: string;
  label: string;
  address: string;
  lat: number | null;
  lng: number | null;
}

const labelIcons: Record<string, typeof MapPin> = { Home: Home, Work: Briefcase };

const SavedAddresses = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formLabel, setFormLabel] = useState("Home");
  const [formAddress, setFormAddress] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchAddresses = async () => {
    if (!user) return;
    const { data } = await supabase.from("saved_addresses").select("*").eq("user_id", user.id).order("created_at", { ascending: true });
    setAddresses(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAddresses(); }, [user]);

  const resetForm = () => { setShowForm(false); setEditingId(null); setFormLabel("Home"); setFormAddress(""); };

  const handleSave = async () => {
    if (!user || !formAddress.trim()) return;
    setSaving(true);

    if (editingId) {
      const { error } = await supabase.from("saved_addresses").update({ label: formLabel, address: formAddress }).eq("id", editingId);
      if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
      else toast({ title: "Address updated!" });
    } else {
      const { error } = await supabase.from("saved_addresses").insert({ user_id: user.id, label: formLabel, address: formAddress });
      if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
      else toast({ title: "Address saved!" });
    }

    setSaving(false);
    resetForm();
    fetchAddresses();
  };

  const handleEdit = (a: SavedAddress) => {
    setEditingId(a.id);
    setFormLabel(a.label);
    setFormAddress(a.address);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("saved_addresses").delete().eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Address removed" }); fetchAddresses(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Saved Addresses</h2>
          <p className="text-muted-foreground">Manage your frequently used locations</p>
        </div>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Address
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="border-primary/30">
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Label</Label>
                <Select value={formLabel} onValueChange={setFormLabel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Home">Home</SelectItem>
                    <SelectItem value="Work">Work</SelectItem>
                    <SelectItem value="Custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Address</Label>
                <Input placeholder="Enter full address" value={formAddress} onChange={e => setFormAddress(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving || !formAddress.trim()}>
                {saving ? "Saving..." : editingId ? "Update" : "Save"}
              </Button>
              <Button variant="ghost" onClick={resetForm}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-muted-foreground text-center py-8">Loading...</p>
      ) : addresses.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No saved addresses yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add your home and work addresses for faster booking</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {addresses.map(a => {
            const Icon = labelIcons[a.label] || MapPin;
            return (
              <Card key={a.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{a.label}</p>
                      <p className="text-sm text-muted-foreground">{a.address}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(a)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SavedAddresses;
