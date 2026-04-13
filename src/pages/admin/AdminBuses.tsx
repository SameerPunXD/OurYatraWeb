import { useEffect, useMemo, useState } from "react";
import { Bus, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const formatTime = (value: string | null) => (value ? value.slice(0, 5) : "N/A");

const AdminBuses = () => {
  const { toast } = useToast();
  const [buses, setBuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBuses = async () => {
    const { data: busRows, error } = await supabase
      .from("buses")
      .select("*")
      .order("departure_date", { ascending: true })
      .order("departure_time", { ascending: true });

    if (error) {
      toast({ title: "Could not load buses", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const operatorIds = [...new Set((busRows || []).map((bus) => bus.operator_id))];
    const busIds = (busRows || []).map((bus) => bus.id);

    const [profilesRes, bookingsRes] = await Promise.all([
      operatorIds.length > 0 ? supabase.from("profiles").select("id, full_name, email").in("id", operatorIds) : Promise.resolve({ data: [] } as any),
      busIds.length > 0 ? supabase.from("bus_bookings").select("bus_id, status").in("bus_id", busIds) : Promise.resolve({ data: [] } as any),
    ]);

    const profiles = Object.fromEntries(((profilesRes.data as any[]) || []).map((profile) => [profile.id, profile]));
    const bookingCounts = ((bookingsRes.data as any[]) || []).reduce<Record<string, number>>((acc, booking) => {
      if (booking.status === "cancelled") return acc;
      acc[booking.bus_id] = (acc[booking.bus_id] || 0) + 1;
      return acc;
    }, {});

    setBuses(
      (busRows || []).map((bus) => ({
        ...bus,
        operator: profiles[bus.operator_id] || null,
        bookingCount: bookingCounts[bus.id] || 0,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchBuses();
  }, []);

  const updateStatus = async (busId: string, status: string) => {
    const { error } = await supabase.from("buses").update({ status }).eq("id", busId);
    if (error) {
      toast({ title: "Status update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Bus updated", description: `Bus moved to ${status}.` });
    fetchBuses();
  };

  const summary = useMemo(
    () => ({
      active: buses.filter((bus) => bus.status === "active").length,
      draft: buses.filter((bus) => bus.status === "draft").length,
      cancelled: buses.filter((bus) => bus.status === "cancelled").length,
    }),
    [buses],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Buses</h2>
        <p className="text-sm text-muted-foreground">
          Review published routes, intervene on schedules, and verify buses when needed.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="mt-1 text-3xl font-bold text-foreground">{summary.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Draft</p>
            <p className="mt-1 text-3xl font-bold text-foreground">{summary.draft}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Cancelled</p>
            <p className="mt-1 text-3xl font-bold text-foreground">{summary.cancelled}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Bus Routes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading buses...</p>
          ) : buses.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No buses have been listed yet.
            </div>
          ) : (
            buses.map((bus) => (
              <div key={bus.id} className="rounded-lg border p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Bus className="h-4 w-4 text-primary" />
                      <p className="font-medium text-foreground">
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
                      Operator: {bus.operator?.full_name || "Unknown"} ({bus.operator?.email || "No email"})
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Seats: {bus.available_seats}/{bus.total_seats} • Rs {Number(bus.price)} • Bookings: {bus.bookingCount}
                    </p>
                    {bus.notes && (
                      <p className="text-sm text-muted-foreground">
                        Route notes: {bus.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {bus.status !== "active" && (
                      <Button size="sm" onClick={() => updateStatus(bus.id, "active")}>
                        <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                        Verify & publish
                      </Button>
                    )}
                    {bus.status !== "draft" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus(bus.id, "draft")}>
                        Move to draft
                      </Button>
                    )}
                    {bus.status !== "cancelled" && (
                      <Button size="sm" variant="destructive" onClick={() => updateStatus(bus.id, "cancelled")}>
                        Cancel route
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

export default AdminBuses;
