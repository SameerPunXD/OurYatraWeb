import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const GarageServices = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [garageId, setGarageId] = useState<string | null>(null);
  const [services, setServices] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [vehicleCategory, setVehicleCategory] = useState<"two_wheeler" | "four_wheeler" | "both">("both");

  const uploadServiceImage = async (file: File, garageId: string) => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `garage-services/${garageId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("uploads").upload(path, file);
    if (error) throw error;
    return supabase.storage.from("uploads").getPublicUrl(path).data.publicUrl;
  };

  const fetchAll = async () => {
    if (!user) return;
    const { data: garage } = await (supabase as any)
      .from("garages")
      .select("id")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    setGarageId(garage?.id || null);
    if (!garage?.id) return;
    const { data } = await (supabase as any).from("garage_services").select("*").eq("garage_id", garage.id).order("created_at", { ascending: false });
    setServices(data || []);
  };

  useEffect(() => { fetchAll(); }, [user]);

  const addService = async () => {
    if (!garageId || !name || !price) return;
    try {
      const imageUrl = imageFile ? await uploadServiceImage(imageFile, garageId) : null;
      const { error } = await (supabase as any).from("garage_services").insert({
        garage_id: garageId,
        name,
        price: Number(price),
        description: description || null,
        image_url: imageUrl,
        is_available: true,
        vehicle_category: vehicleCategory,
      });
      if (error) throw error;
      setName(""); setPrice(""); setDescription(""); setImageFile(null); setVehicleCategory("both");
      fetchAll();
    } catch (error: any) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    }
  };

  const toggleAvailability = async (serviceId: string, nextValue: boolean) => {
    const { error } = await (supabase as any)
      .from("garage_services")
      .update({ is_available: nextValue })
      .eq("id", serviceId);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    fetchAll();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Garage Services</h2>
      {!garageId ? (
        <Card><CardContent className="p-6 text-muted-foreground">No garage profile found. Complete garage signup first.</CardContent></Card>
      ) : (
        <>
            <Card>
              <CardContent className="p-4 space-y-2">
                <Input placeholder="Service name" value={name} onChange={(e) => setName(e.target.value)} />
                <Input placeholder="Price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
                <Input placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "two_wheeler", label: "Two-Wheeler" },
                    { value: "four_wheeler", label: "Four-Wheeler" },
                    { value: "both", label: "Both" },
                  ].map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      size="sm"
                      variant={vehicleCategory === option.value ? "default" : "outline"}
                      onClick={() => setVehicleCategory(option.value as "two_wheeler" | "four_wheeler" | "both")}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
                <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                <Button onClick={addService}>Add Service</Button>
              </CardContent>
            </Card>

          {services.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-4 space-y-2">
                {s.image_url && <img src={s.image_url} alt={s.name} className="h-28 w-full object-cover rounded-md border" />}
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{s.name}</p>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${s.is_available ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                    {s.is_available ? "AVAILABLE" : "PAUSED"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{s.description || "—"}</p>
                <p className="text-sm">Rs {s.price}</p>
                <p className="text-xs text-muted-foreground">
                  {s.vehicle_category === "two_wheeler" ? "Two-wheeler" : s.vehicle_category === "four_wheeler" ? "Four-wheeler" : "Both vehicle types"}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => toggleAvailability(s.id, !s.is_available)}
                >
                  {s.is_available ? "Pause Service" : "Make Available"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
};

export default GarageServices;
