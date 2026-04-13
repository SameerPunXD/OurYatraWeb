import { useEffect, useMemo, useState } from "react";
import { Edit, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import SubscriptionGate from "@/components/SubscriptionGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NEPAL_DISTRICTS } from "@/lib/nepalDistricts";
import type { Database } from "@/integrations/supabase/types";

type BusRow = Database["public"]["Tables"]["buses"]["Row"];

interface BusFormState {
  busName: string;
  busNumber: string;
  fromDistrict: string;
  toDistrict: string;
  departureDate: string;
  departureTime: string;
  arrivalTime: string;
  totalSeats: string;
  price: string;
  amenities: string;
  notes: string;
  status: "draft" | "active" | "cancelled";
}

const emptyForm: BusFormState = {
  busName: "",
  busNumber: "",
  fromDistrict: "",
  toDistrict: "",
  departureDate: new Date().toISOString().split("T")[0],
  departureTime: "07:00",
  arrivalTime: "12:00",
  totalSeats: "30",
  price: "0",
  amenities: "",
  notes: "",
  status: "draft",
};

const formatTime = (value: string | null) => (value ? value.slice(0, 5) : "N/A");

const BusOperatorBuses = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [buses, setBuses] = useState<BusRow[]>([]);
  const [form, setForm] = useState<BusFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const editingBus = useMemo(
    () => buses.find((bus) => bus.id === editingId) || null,
    [buses, editingId],
  );

  const fetchBuses = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("buses")
      .select("*")
      .eq("operator_id", user.id)
      .order("departure_date", { ascending: true })
      .order("departure_time", { ascending: true });

    if (error) {
      toast({
        title: "Could not load buses",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    setBuses(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchBuses();
  }, [user]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const startEdit = (bus: BusRow) => {
    setEditingId(bus.id);
    setForm({
      busName: bus.bus_name,
      busNumber: bus.bus_number,
      fromDistrict: bus.from_district,
      toDistrict: bus.to_district,
      departureDate: bus.departure_date,
      departureTime: bus.departure_time.slice(0, 5),
      arrivalTime: bus.arrival_time ? bus.arrival_time.slice(0, 5) : "",
      totalSeats: String(bus.total_seats),
      price: String(bus.price),
      amenities: (bus.amenities || []).join(", "),
      notes: bus.notes || "",
      status: (bus.status as BusFormState["status"]) || "draft",
    });
  };

  const updateBusStatus = async (busId: string, status: BusFormState["status"]) => {
    const { error } = await supabase.from("buses").update({ status }).eq("id", busId);

    if (error) {
      toast({
        title: "Status update failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: status === "active" ? "Bus verified and published" : "Bus status updated",
      description: status === "active" ? "Users can now see and book this route." : `Route moved to ${status}.`,
    });
    fetchBuses();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    if (!form.busName.trim() || !form.busNumber.trim() || !form.fromDistrict || !form.toDistrict) {
      toast({
        title: "Missing bus details",
        description: "Bus name, number, route, and schedule are required.",
        variant: "destructive",
      });
      return;
    }

    if (form.fromDistrict === form.toDistrict) {
      toast({
        title: "Invalid route",
        description: "Origin and destination districts must be different.",
        variant: "destructive",
      });
      return;
    }

    const totalSeats = Number(form.totalSeats);
    const price = Number(form.price);

    if (!Number.isFinite(totalSeats) || totalSeats < 1 || !Number.isFinite(price) || price <= 0) {
      toast({
        title: "Invalid capacity or price",
        description: "Enter a valid seat count and ticket price.",
        variant: "destructive",
      });
      return;
    }

    const amenities = form.amenities
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const payload = {
      bus_name: form.busName.trim(),
      bus_number: form.busNumber.trim(),
      from_district: form.fromDistrict,
      to_district: form.toDistrict,
      departure_date: form.departureDate,
      departure_time: `${form.departureTime}:00`,
      arrival_time: form.arrivalTime ? `${form.arrivalTime}:00` : null,
      total_seats: totalSeats,
      price,
      amenities,
      notes: form.notes.trim() || null,
      status: form.status,
    } as const;

    setSaving(true);

    if (editingBus) {
      const seatDelta = totalSeats - editingBus.total_seats;
      const nextAvailableSeats = Math.max(editingBus.available_seats + seatDelta, 0);
      const { error } = await supabase
        .from("buses")
        .update({ ...payload, available_seats: nextAvailableSeats })
        .eq("id", editingBus.id);

      if (error) {
        toast({
          title: "Bus update failed",
          description: error.message,
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      toast({
        title: "Bus updated",
        description: "Route details saved successfully.",
      });
    } else {
      const { error } = await supabase.from("buses").insert({
        operator_id: user.id,
        ...payload,
        available_seats: totalSeats,
      });

      if (error) {
        toast({
          title: "Bus creation failed",
          description: error.message,
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      toast({
        title: "Bus route created",
        description: "Save it as draft or publish it when verified.",
      });
    }

    setSaving(false);
    resetForm();
    fetchBuses();
  };

  return (
    <SubscriptionGate fallbackMessage="Subscribe to manage bus routes on OurYatra.">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Manage Buses</h2>
          <p className="text-sm text-muted-foreground">
            Create schedules, maintain seat inventory, and verify routes before publishing them.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{editingBus ? "Edit Bus Route" : "Add New Bus Route"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Bus Name</Label>
                  <Input value={form.busName} onChange={(event) => setForm((current) => ({ ...current, busName: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Bus Number</Label>
                  <Input value={form.busNumber} onChange={(event) => setForm((current) => ({ ...current, busNumber: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>From District</Label>
                  <Select value={form.fromDistrict} onValueChange={(value) => setForm((current) => ({ ...current, fromDistrict: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select district" />
                    </SelectTrigger>
                    <SelectContent>
                      {NEPAL_DISTRICTS.map((district) => (
                        <SelectItem key={district} value={district}>
                          {district}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>To District</Label>
                  <Select value={form.toDistrict} onValueChange={(value) => setForm((current) => ({ ...current, toDistrict: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select district" />
                    </SelectTrigger>
                    <SelectContent>
                      {NEPAL_DISTRICTS.map((district) => (
                        <SelectItem key={district} value={district}>
                          {district}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Departure Date</Label>
                  <Input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={form.departureDate}
                    onChange={(event) => setForm((current) => ({ ...current, departureDate: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Departure Time</Label>
                  <Input type="time" value={form.departureTime} onChange={(event) => setForm((current) => ({ ...current, departureTime: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Arrival Time</Label>
                  <Input type="time" value={form.arrivalTime} onChange={(event) => setForm((current) => ({ ...current, arrivalTime: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Total Seats</Label>
                  <Input type="number" min={1} value={form.totalSeats} onChange={(event) => setForm((current) => ({ ...current, totalSeats: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Price Per Seat (Rs)</Label>
                  <Input type="number" min={1} value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as BusFormState["status"] }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Amenities</Label>
                  <Input
                    value={form.amenities}
                    onChange={(event) => setForm((current) => ({ ...current, amenities: event.target.value }))}
                    placeholder="WiFi, AC, Charging Port"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Boarding / Arrival Notes</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                    placeholder="Example: Board at New Bus Park gate 3. Arrival stop is Koteshwor Chowk near the bridge."
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : editingBus ? "Save changes" : "Create route"}
                </Button>
                {editingBus && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel edit
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">My Bus Routes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading bus routes...</p>
            ) : buses.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No bus routes yet. Add your first route above.
              </div>
            ) : (
              buses.map((bus) => {
                const amenities = bus.amenities || [];
                return (
                <Card key={bus.id} className="border-primary/10">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-foreground">
                            {bus.bus_name} ({bus.bus_number})
                          </p>
                          <Badge variant={bus.status === "active" ? "secondary" : "outline"}>{bus.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {bus.from_district} to {bus.to_district}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(bus.departure_date).toLocaleDateString()} • {formatTime(bus.departure_time)} to {formatTime(bus.arrival_time)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Seats: {bus.available_seats}/{bus.total_seats} • Rs {Number(bus.price)} per seat
                        </p>
                        {amenities.length > 0 && (
                          <p className="text-sm text-muted-foreground">Amenities: {amenities.join(", ")}</p>
                        )}
                        {bus.notes && (
                          <p className="text-sm text-muted-foreground">
                            Route notes: {bus.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => startEdit(bus)}>
                          <Edit className="mr-1 h-3.5 w-3.5" />
                          Edit
                        </Button>
                        {bus.status !== "active" && (
                          <Button size="sm" onClick={() => updateBusStatus(bus.id, "active")}>
                            <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                            Verify & publish
                          </Button>
                        )}
                        {bus.status === "active" && (
                          <Button variant="outline" size="sm" onClick={() => updateBusStatus(bus.id, "draft")}>
                            Move to draft
                          </Button>
                        )}
                        {bus.status !== "cancelled" && (
                          <Button variant="destructive" size="sm" onClick={() => updateBusStatus(bus.id, "cancelled")}>
                            Cancel route
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )})
            )}
          </CardContent>
        </Card>
      </div>
    </SubscriptionGate>
  );
};

export default BusOperatorBuses;
