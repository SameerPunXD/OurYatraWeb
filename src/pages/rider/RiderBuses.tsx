import { useEffect, useMemo, useState } from "react";
import { Bus, CalendarDays, Clock3, MapPin, Ticket, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import SubscriptionGate from "@/components/SubscriptionGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NEPAL_DISTRICTS } from "@/lib/nepalDistricts";
import type { Database } from "@/integrations/supabase/types";

type BusRow = Database["public"]["Tables"]["buses"]["Row"];

const formatTime = (value: string | null) => (value ? value.slice(0, 5) : "N/A");
const todayValue = () => new Date().toISOString().split("T")[0];

const RiderBuses = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [fromDistrict, setFromDistrict] = useState("");
  const [toDistrict, setToDistrict] = useState("");
  const [travelDate, setTravelDate] = useState(todayValue());
  const [buses, setBuses] = useState<BusRow[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTouched, setSearchTouched] = useState(false);
  const [bookingBusId, setBookingBusId] = useState<string | null>(null);
  const [seatSelections, setSeatSelections] = useState<Record<string, number>>({});
  const [passengerForms, setPassengerForms] = useState<Record<string, { name: string; phone: string }>>({});

  const canSearch = Boolean(fromDistrict && toDistrict && travelDate && fromDistrict !== toDistrict);

  const sortedBookings = useMemo(
    () => [...bookings].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [bookings],
  );

  const ensurePassengerDefaults = (busId: string) => {
    setPassengerForms((current) => {
      if (current[busId]) return current;
      return {
        ...current,
        [busId]: {
          name: profile?.full_name || "",
          phone: profile?.phone || "",
        },
      };
    });
    setSeatSelections((current) => ({ ...current, [busId]: current[busId] || 1 }));
  };

  const fetchBookings = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("bus_bookings")
      .select(
        "id, bus_id, seats_booked, total_amount, passenger_name, passenger_phone, status, created_at, buses(id, bus_name, bus_number, from_district, to_district, departure_date, departure_time, status, notes)",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Could not load bus bookings",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setBookings(data || []);
  };

  useEffect(() => {
    fetchBookings();
  }, [user]);

  const searchBuses = async () => {
    if (!canSearch) return;
    setLoading(true);
    setSearchTouched(true);

    const { data, error } = await supabase
      .from("buses")
      .select("*")
      .eq("status", "active")
      .eq("from_district", fromDistrict)
      .eq("to_district", toDistrict)
      .eq("departure_date", travelDate)
      .gt("available_seats", 0)
      .order("departure_time", { ascending: true });

    if (error) {
      toast({
        title: "Could not search buses",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    setBuses(data || []);
    (data || []).forEach((bus) => ensurePassengerDefaults(bus.id));
    setLoading(false);
  };

  const handleBook = async (bus: BusRow) => {
    if (!user) return;

    const seats = seatSelections[bus.id] || 1;
    const passengerForm = passengerForms[bus.id] || {
      name: profile?.full_name || "",
      phone: profile?.phone || "",
    };

    if (!passengerForm.name.trim() || !passengerForm.phone.trim()) {
      toast({
        title: "Passenger details required",
        description: "Enter passenger name and phone before booking.",
        variant: "destructive",
      });
      return;
    }

    if (seats < 1 || seats > bus.available_seats) {
      toast({
        title: "Invalid seat count",
        description: `Choose between 1 and ${bus.available_seats} seats.`,
        variant: "destructive",
      });
      return;
    }

    setBookingBusId(bus.id);

    const { error } = await supabase.from("bus_bookings").insert({
      bus_id: bus.id,
      user_id: user.id,
      seats_booked: seats,
      total_amount: Number(bus.price) * seats,
      passenger_name: passengerForm.name.trim(),
      passenger_phone: passengerForm.phone.trim(),
      status: "confirmed",
    });

    if (error) {
      toast({
        title: "Booking failed",
        description: error.message,
        variant: "destructive",
      });
      setBookingBusId(null);
      return;
    }

    toast({
      title: "Bus booked",
      description: `Your ${seats} seat booking for ${bus.bus_name} is confirmed.`,
    });

    await Promise.all([searchBuses(), fetchBookings()]);
    setBookingBusId(null);
  };

  const handleCancelBooking = async (bookingId: string) => {
    const { error } = await supabase
      .from("bus_bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId);

    if (error) {
      toast({
        title: "Could not cancel booking",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Booking cancelled",
      description: "Your bus booking has been cancelled.",
    });

    await Promise.all([fetchBookings(), canSearch ? searchBuses() : Promise.resolve()]);
  };

  return (
    <SubscriptionGate fallbackMessage="Subscribe to book buses on OurYatra.">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Buses</h2>
          <p className="text-sm text-muted-foreground">
            Search scheduled buses across Nepal&apos;s 77 districts and reserve your seats.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Search Buses</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>From</Label>
              <Select value={fromDistrict} onValueChange={setFromDistrict}>
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
              <Label>To</Label>
              <Select value={toDistrict} onValueChange={setToDistrict}>
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
              <Label>Date</Label>
              <Input type="date" min={todayValue()} value={travelDate} onChange={(event) => setTravelDate(event.target.value)} />
            </div>

            <div className="flex items-end">
              <Button className="w-full" disabled={!canSearch || loading} onClick={searchBuses}>
                {loading ? "Searching..." : "Search buses"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Available Buses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!searchTouched ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground" />
            ) : buses.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No active buses found for this route and date.
              </div>
            ) : (
              buses.map((bus) => {
                const amenities = bus.amenities || [];
                const form = passengerForms[bus.id] || { name: profile?.full_name || "", phone: profile?.phone || "" };
                const seats = seatSelections[bus.id] || 1;

                return (
                  <Card key={bus.id} className="border-primary/10">
                    <CardContent className="space-y-4 p-5">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{bus.bus_number}</Badge>
                            <span className="font-semibold text-foreground">{bus.bus_name}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {bus.from_district} to {bus.to_district}
                            </span>
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-4 w-4" />
                              {new Date(bus.departure_date).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock3 className="h-4 w-4" />
                              {formatTime(bus.departure_time)} to {formatTime(bus.arrival_time)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              {bus.available_seats}/{bus.total_seats} seats left
                            </span>
                          </div>
                          {amenities.length > 0 && (
                            <p className="text-sm text-muted-foreground">
                              Amenities: {amenities.join(", ")}
                            </p>
                          )}
                          {bus.notes && (
                            <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
                              <span className="font-medium">Boarding / arrival notes:</span> {bus.notes}
                            </div>
                          )}
                        </div>

                        <div className="rounded-lg bg-primary/5 px-4 py-3 text-right">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Fare</p>
                          <p className="text-2xl font-bold text-primary">Rs {Number(bus.price)}</p>
                          <p className="text-xs text-muted-foreground">per seat</p>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Passenger Name</Label>
                          <Input
                            value={form.name}
                            onChange={(event) =>
                              setPassengerForms((current) => ({
                                ...current,
                                [bus.id]: {
                                  ...(current[bus.id] || form),
                                  name: event.target.value,
                                },
                              }))
                            }
                            placeholder="Passenger full name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Passenger Phone</Label>
                          <Input
                            value={form.phone}
                            onChange={(event) =>
                              setPassengerForms((current) => ({
                                ...current,
                                [bus.id]: {
                                  ...(current[bus.id] || form),
                                  phone: event.target.value,
                                },
                              }))
                            }
                            placeholder="98XXXXXXXX"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Seats</Label>
                          <Input
                            type="number"
                            min={1}
                            max={bus.available_seats}
                            value={seats}
                            onChange={(event) =>
                              setSeatSelections((current) => ({
                                ...current,
                                [bus.id]: Number(event.target.value) || 1,
                              }))
                            }
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                          Total: <span className="font-semibold text-foreground">Rs {Number(bus.price) * seats}</span>
                        </p>
                        <Button onClick={() => handleBook(bus)} disabled={bookingBusId === bus.id}>
                          {bookingBusId === bus.id ? "Booking..." : "Book this bus"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">My Bus Bookings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sortedBookings.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                You have not booked any buses yet.
              </div>
            ) : (
              sortedBookings.map((booking: any) => (
                <div key={booking.id} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
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
                      {booking.buses?.notes && (
                        <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
                          <span className="font-medium">Boarding / arrival notes:</span> {booking.buses.notes}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={booking.status === "cancelled" ? "outline" : "secondary"}>{booking.status}</Badge>
                      {booking.status !== "cancelled" && (
                        <Button variant="outline" size="sm" onClick={() => handleCancelBooking(booking.id)}>
                          Cancel booking
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
    </SubscriptionGate>
  );
};

export default RiderBuses;
