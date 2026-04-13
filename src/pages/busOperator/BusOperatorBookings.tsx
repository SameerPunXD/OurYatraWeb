import { useEffect, useMemo, useState } from "react";
import { Phone, Ticket, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SubscriptionGate from "@/components/SubscriptionGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const formatTime = (value: string | null) => (value ? value.slice(0, 5) : "N/A");

const BusOperatorBookings = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) return;

      const { data: buses } = await supabase.from("buses").select("id").eq("operator_id", user.id);
      const busIds = (buses || []).map((bus) => bus.id);

      if (busIds.length === 0) {
        setBookings([]);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("bus_bookings")
        .select(
          "id, bus_id, seats_booked, total_amount, passenger_name, passenger_phone, status, created_at, buses(bus_name, bus_number, from_district, to_district, departure_date, departure_time)",
        )
        .in("bus_id", busIds)
        .order("created_at", { ascending: false });

      setBookings(data || []);
      setLoading(false);
    };

    load();
  }, [user]);

  const activeBookings = useMemo(
    () => bookings.filter((booking) => booking.status !== "cancelled"),
    [bookings],
  );

  return (
    <SubscriptionGate fallbackMessage="Subscribe to access passenger bus bookings on OurYatra.">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Bus Bookings</h2>
          <p className="text-sm text-muted-foreground">
            Track passenger reservations for your published bus schedules.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current Bookings ({activeBookings.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading bookings...</p>
            ) : bookings.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No passenger bookings yet.
              </div>
            ) : (
              bookings.map((booking) => (
                <div key={booking.id} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Ticket className="h-4 w-4 text-primary" />
                        <p className="font-medium text-foreground">
                          {booking.buses?.bus_name || "Bus"} ({booking.buses?.bus_number || "N/A"})
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {booking.buses?.from_district} to {booking.buses?.to_district}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {booking.buses?.departure_date
                          ? new Date(booking.buses.departure_date).toLocaleDateString()
                          : "Date not available"}
                        {" • "}
                        {formatTime(booking.buses?.departure_time || null)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Seats: {booking.seats_booked} • Total: Rs {Number(booking.total_amount)}
                      </p>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          {booking.passenger_name || "Passenger name not provided"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="h-4 w-4" />
                          {booking.passenger_phone || "Phone not provided"}
                        </span>
                      </div>
                    </div>
                    <Badge variant={booking.status === "cancelled" ? "outline" : "secondary"}>{booking.status}</Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </SubscriptionGate>
  );
};

export default BusOperatorBookings;
