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

  const uploadServiceImage = async (file: File, garageId: string) => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `garage-services/${garageId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("uploads").upload(path, file);
    if (error) throw error;
    return supabase.storage.from("uploads").getPublicUrl(path).data.publicUrl;
  };

  const fetchAll = async () => {
    if (!user) return;
    const { data: garage } = await (supabase as any).from("garages").select("id").eq("owner_id", user.id).maybeSingle();
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
      });
      if (error) throw error;
      setName(""); setPrice(""); setDescription(""); setImageFile(null);
      fetchAll();
    } catch (error: any) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    }
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
              <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
              <Button onClick={addService}>Add Service</Button>
            </CardContent>
          </Card>

          {services.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-4 space-y-2">
                {s.image_url && <img src={s.image_url} alt={s.name} className="h-28 w-full object-cover rounded-md border" />}
                <p className="font-semibold">{s.name}</p>
                <p className="text-sm text-muted-foreground">{s.description || "—"}</p>
                <p className="text-sm">Rs {s.price}</p>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
};

export default GarageServices;
