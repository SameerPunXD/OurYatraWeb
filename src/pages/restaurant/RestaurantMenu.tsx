import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Plus, Trash2, Pencil, X, Check, UtensilsCrossed, Upload, ChevronDown, Image } from "lucide-react";

const RestaurantMenu = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", price: "", category: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    if (!user) return;
    const { data: rest } = await supabase.from("restaurants").select("*").eq("owner_id", user.id).maybeSingle();
    setRestaurant(rest);
    if (rest) {
      const { data: items } = await supabase.from("menu_items").select("*").eq("restaurant_id", rest.id).order("category");
      setMenuItems(items || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const resetForm = () => {
    setForm({ name: "", description: "", price: "", category: "" });
    setEditingId(null);
    setShowForm(false);
    setImageFile(null);
    setImagePreview(null);
  };

  const startEdit = (item: any) => {
    setForm({ name: item.name, description: item.description || "", price: String(item.price), category: item.category || "" });
    setEditingId(item.id);
    setImagePreview(item.image_url || null);
    setImageFile(null);
    setShowForm(true);
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `menu/${restaurant.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("uploads").upload(path, file);
    if (error) { toast({ title: "Upload failed", description: error.message, variant: "destructive" }); return null; }
    const { data } = supabase.storage.from("uploads").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant) return;
    setUploading(true);

    let imageUrl: string | null = imagePreview;
    if (imageFile) {
      imageUrl = await uploadImage(imageFile);
    }

    const payload = {
      name: form.name,
      description: form.description || null,
      price: parseFloat(form.price),
      category: form.category || null,
      image_url: imageUrl,
    };

    if (editingId) {
      const { error } = await supabase.from("menu_items").update(payload).eq("id", editingId);
      if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); setUploading(false); return; }
      toast({ title: "Item updated!" });
    } else {
      const { error } = await supabase.from("menu_items").insert({ ...payload, restaurant_id: restaurant.id });
      if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); setUploading(false); return; }
      toast({ title: "Item added!" });
    }
    setUploading(false);
    resetForm();
    fetchData();
  };

  const toggleAvailability = async (id: string, available: boolean) => {
    await supabase.from("menu_items").update({ is_available: available }).eq("id", id);
    fetchData();
  };

  const deleteItem = async (id: string) => {
    await supabase.from("menu_items").delete().eq("id", id);
    fetchData();
  };

  const toggleOpen = async () => {
    if (!restaurant) return;
    await supabase.from("restaurants").update({ is_open: !restaurant.is_open }).eq("id", restaurant.id);
    fetchData();
  };

  // Group by category
  const grouped = menuItems.reduce<Record<string, any[]>>((acc, item) => {
    const cat = item.category || "Uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});
  const categories = Object.keys(grouped).sort();

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  if (!restaurant) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <h2 className="text-2xl font-bold text-foreground">Set Up Your Restaurant</h2>
        <Card>
          <CardContent className="p-12 text-center">
            <UtensilsCrossed className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">Create your restaurant from Settings to start receiving orders</p>
            <Button onClick={() => window.location.href = "/restaurant/settings"}>Go to Settings</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{restaurant.name} — Menu</h2>
          <p className="text-muted-foreground">{restaurant.cuisine_type} · {menuItems.length} items</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{restaurant.is_open ? "Open" : "Closed"}</span>
            <Switch checked={restaurant.is_open} onCheckedChange={toggleOpen} />
          </div>
          <Button onClick={() => { resetForm(); setShowForm(true); }}><Plus className="h-4 w-4 mr-1" /> Add Item</Button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit}>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
                <div className="space-y-1"><Label className="text-xs">Price (Rs)</Label><Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required /></div>
                <div className="space-y-1"><Label className="text-xs">Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">Category</Label><Input placeholder="e.g. Mains, Drinks" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} /></div>
              </div>

              {/* Image upload */}
              <div className="space-y-1">
                <Label className="text-xs">Photo</Label>
                <div className="flex items-center gap-3">
                  {imagePreview && (
                    <img src={imagePreview} alt="Preview" className="h-16 w-16 rounded-md object-cover border border-border" />
                  )}
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-3 w-3 mr-1" /> {imagePreview ? "Change" : "Upload"}
                  </Button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={uploading}>
                  <Check className="h-3 w-3 mr-1" />{uploading ? "Saving..." : editingId ? "Update" : "Add"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={resetForm}><X className="h-3 w-3 mr-1" />Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </form>
      )}

      {categories.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No menu items yet. Add your first item!</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => (
            <Collapsible key={cat} open={openCategories[cat] !== false} onOpenChange={(open) => setOpenCategories((p) => ({ ...p, [cat]: open }))}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                <span className="font-semibold text-foreground">{cat} ({grouped[cat].length})</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 mt-2">
                {grouped[cat].map((item: any) => (
                  <Card key={item.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="h-12 w-12 rounded-md object-cover border border-border" />
                        ) : (
                          <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center">
                            <Image className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-foreground">{item.name}</p>
                          {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                          <p className="text-sm font-semibold text-primary">Rs {item.price}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={item.is_available ? "default" : "secondary"} className="text-xs">
                          {item.is_available ? "Available" : "Unavailable"}
                        </Badge>
                        <Switch checked={item.is_available} onCheckedChange={v => toggleAvailability(item.id, v)} />
                        <Button size="icon" variant="ghost" onClick={() => startEdit(item)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteItem(item.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      )}
    </div>
  );
};

export default RestaurantMenu;
