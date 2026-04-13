import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bus, CalendarClock, Ticket, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import StatsCard from "@/components/dashboard/StatsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/integrations/supabase/types";

type BusRow = Database["public"]["Tables"]["buses"]["Row"];

const formatTime = (value: string | null) => (value ? value.slice(0, 5) : "N/A");
const routeDateTime = (bus: BusRow) => `${new Date(bus.departure_date).toLocaleDateString()} • ${formatTime(bus.departure_time)}`;

const BusOperatorDashboard = () => {
  const { user, profile } = useAuth();
  const [buses, setBuses] = useState<BusRow[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) return;

      const { data: busRows } = await supabase
        .from("buses")
        .select("*")
        .eq("operator_id", user.id)
        .order("departure_date", { ascending: true })
        .order("departure_time", { ascending: true });

      const operatorBuses = busRows || [];
      setBuses(operatorBuses);

      if (operatorBuses.length === 0) {
        setBookings([]);
        setLoading(false);
        return;
      }

      const { data: bookingRows } = await supabase
        .from("bus_bookings")
        .select("*")
        .in(
          "bus_id",
          operatorBuses.map((bus) => bus.id),
        )
        .order("created_at", { ascending: false });

      setBookings(bookingRows || []);
      setLoading(false);
    };

    load();
  }, [user]);

  const stats = useMemo(() => {
    const activeBuses = buses.filter((bus) => bus.status === "active").length;
    const draftBuses = buses.filter((bus) => bus.status === "draft").length;
    const confirmedBookings = bookings.filter((booking) => booking.status !== "cancelled");
    const totalRevenue = confirmedBookings.reduce((sum, booking) => sum + Number(booking.total_amount || 0), 0);

    return {
      totalBuses: buses.length,
      activeBuses,
      draftBuses,
      totalBookings: confirmedBookings.length,
      totalRevenue,
    };
  }, [buses, bookings]);

  const upcomingBuses = buses
    .filter((bus) => bus.status !== "cancelled")
    .slice(0, 5);

  if (loading) {
    return <p className="text-muted-foreground">Loading dashboard...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Bus Operator Dashboard</h2>
          <p className="text-muted-foreground">Manage routes, schedules, and passenger bookings.</p>
        </div>
        <Badge variant="secondary">{profile?.full_name || "Bus Operator"}</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="Total Buses" value={stats.totalBuses} icon={Bus} description="All listed routes" />
        <StatsCard title="Active Routes" value={stats.activeBuses} icon={CalendarClock} description="Visible to users" />
        <StatsCard title="Bookings" value={stats.totalBookings} icon={Ticket} description="Confirmed tickets" />
        <StatsCard title="Revenue" value={`Rs ${stats.totalRevenue}`} icon={Wallet} description="Non-cancelled bookings" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Route Status</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link to="/bus-operator/buses">Manage buses</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Draft routes</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{stats.draftBuses}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Publish a route from the bus management page when it is verified and ready for passengers.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Passenger Bookings</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link to="/bus-operator/bookings">View bookings</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You have {stats.totalBookings} current passenger bookings across all published schedules.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upcoming Routes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {upcomingBuses.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No bus schedules yet. Add your first route to start receiving bookings.
            </div>
          ) : (
            upcomingBuses.map((bus) => (
              <div key={bus.id} className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-foreground">
                    {bus.bus_name} ({bus.bus_number})
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {bus.from_district} to {bus.to_district}
                  </p>
                  <p className="text-sm text-muted-foreground">{routeDateTime(bus)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={bus.status === "active" ? "secondary" : "outline"}>{bus.status}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {bus.available_seats}/{bus.total_seats} seats
                  </span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BusOperatorDashboard;
