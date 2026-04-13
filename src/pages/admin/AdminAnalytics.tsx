import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import StatsCard from "@/components/dashboard/StatsCard";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart
} from "recharts";
import { format, subDays, differenceInDays } from "date-fns";
import {
  Car, Package, UtensilsCrossed, Users, UserCheck, Store,
  TrendingUp, Activity, CalendarIcon, Download, Star,
  XCircle, CheckCircle, BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";

const COLORS = [
  "hsl(0, 72%, 51%)",    // primary red
  "hsl(262, 83%, 58%)",  // purple
  "hsl(38, 92%, 50%)",   // amber
  "hsl(160, 60%, 45%)",  // emerald
  "hsl(210, 80%, 55%)",  // blue
  "hsl(330, 70%, 55%)",  // pink
];

type DateRange = { from: Date; to: Date };
type Preset = "today" | "7d" | "30d" | "90d" | "custom";

const AdminAnalytics = () => {
  const [preset, setPreset] = useState<Preset>("30d");
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  // Data states
  const [rides, setRides] = useState<any[]>([]);
  const [parcels, setParcels] = useState<any[]>([]);
  const [foodOrders, setFoodOrders] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [ratings, setRatings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const handlePreset = (p: Preset) => {
    setPreset(p);
    const now = new Date();
    if (p === "today") setDateRange({ from: new Date(now.setHours(0,0,0,0)), to: new Date() });
    else if (p === "7d") setDateRange({ from: subDays(new Date(), 7), to: new Date() });
    else if (p === "30d") setDateRange({ from: subDays(new Date(), 30), to: new Date() });
    else if (p === "90d") setDateRange({ from: subDays(new Date(), 90), to: new Date() });
  };

  const applyCustomRange = () => {
    if (customFrom && customTo) {
      setDateRange({ from: customFrom, to: customTo });
      setPreset("custom");
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const fromISO = dateRange.from.toISOString();
      const toISO = dateRange.to.toISOString();

      const [ridesR, parcelsR, foodR, profilesR, driversR, restaurantsR, subsR, plansR, ratingsR] = await Promise.all([
        supabase.from("rides").select("id, status, created_at, cancellation_reason, driver_id, fare").gte("created_at", fromISO).lte("created_at", toISO),
        supabase.from("parcels").select("id, status, created_at, fare").gte("created_at", fromISO).lte("created_at", toISO),
        supabase.from("food_orders").select("id, status, created_at, total_amount, restaurant_id, driver_id").gte("created_at", fromISO).lte("created_at", toISO),
        supabase.from("profiles").select("id, created_at, city, updated_at"),
        supabase.from("driver_profiles").select("id, is_online"),
        supabase.from("restaurants").select("id, name, is_open"),
        supabase.from("subscriptions").select("id, plan_id, status, created_at, user_id").gte("created_at", fromISO).lte("created_at", toISO),
        supabase.from("subscription_plans").select("id, name, price, role"),
        supabase.from("ratings").select("id, rating, order_type, to_user_id, restaurant_id").gte("created_at", fromISO).lte("created_at", toISO),
      ]);

      setRides(ridesR.data || []);
      setParcels(parcelsR.data || []);
      setFoodOrders(foodR.data || []);
      setProfiles(profilesR.data || []);
      setDrivers(driversR.data || []);
      setRestaurants(restaurantsR.data || []);
      setSubscriptions(subsR.data || []);
      setPlans(plansR.data || []);
      setRatings(ratingsR.data || []);
      setLoading(false);
    };
    load();
  }, [dateRange]);

  // Utility: group items by day
  const groupByDay = (items: any[], field = "created_at") => {
    const days = differenceInDays(dateRange.to, dateRange.from);
    const map: Record<string, number> = {};
    for (let i = days; i >= 0; i--) {
      map[format(subDays(dateRange.to, i), "MM/dd")] = 0;
    }
    items.forEach(item => {
      const day = format(new Date(item[field]), "MM/dd");
      if (map[day] !== undefined) map[day]++;
    });
    return Object.entries(map).map(([date, count]) => ({ date, count }));
  };

  // ---- COMPUTED METRICS ----
  const totalRides = rides.length;
  const totalParcels = parcels.length;
  const totalFood = foodOrders.length;
  const totalUsers = profiles.length;

  const activeDrivers = drivers.filter(d => d.is_online).length;
  const activeRestaurants = restaurants.filter(r => r.is_open).length;
  const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
  const mau = profiles.filter(p => p.updated_at >= thirtyDaysAgo).length;
  const activeSubs = subscriptions.filter(s => s.status === "active").length;

  const completedRides = rides.filter(r => r.status === "completed").length;
  const cancelledRides = rides.filter(r => r.status === "cancelled").length;
  const completionRate = totalRides > 0 ? ((completedRides / totalRides) * 100).toFixed(1) : "0";
  const cancellationRate = totalRides > 0 ? ((cancelledRides / totalRides) * 100).toFixed(1) : "0";

  const rideRatings = ratings.filter(r => r.order_type === "ride" && r.rating);
  const avgRideRating = rideRatings.length > 0 ? (rideRatings.reduce((s, r) => s + r.rating, 0) / rideRatings.length).toFixed(1) : "N/A";
  const restRatings = ratings.filter(r => r.restaurant_id);
  const avgRestRating = restRatings.length > 0 ? (restRatings.reduce((s, r) => s + r.rating, 0) / restRatings.length).toFixed(1) : "N/A";

  // ---- GROWTH CHARTS ----
  const growthData = useMemo(() => {
    const days = differenceInDays(dateRange.to, dateRange.from);
    const map: Record<string, { date: string; rides: number; parcels: number; food: number }> = {};
    for (let i = days; i >= 0; i--) {
      const d = format(subDays(dateRange.to, i), "MM/dd");
      map[d] = { date: d, rides: 0, parcels: 0, food: 0 };
    }
    rides.forEach(r => { const d = format(new Date(r.created_at), "MM/dd"); if (map[d]) map[d].rides++; });
    parcels.forEach(r => { const d = format(new Date(r.created_at), "MM/dd"); if (map[d]) map[d].parcels++; });
    foodOrders.forEach(r => { const d = format(new Date(r.created_at), "MM/dd"); if (map[d]) map[d].food++; });
    return Object.values(map);
  }, [rides, parcels, foodOrders, dateRange]);

  const userGrowthData = useMemo(() => groupByDay(profiles.filter(p => new Date(p.created_at) >= dateRange.from)), [profiles, dateRange]);

  // ---- SUBSCRIPTION REVENUE ----
  const planMap = Object.fromEntries(plans.map(p => [p.id, p]));
  const revenueByPlan = useMemo(() => {
    const map: Record<string, { name: string; revenue: number; count: number }> = {};
    subscriptions.forEach(s => {
      const plan = planMap[s.plan_id];
      if (!plan) return;
      if (!map[s.plan_id]) map[s.plan_id] = { name: plan.name, revenue: 0, count: 0 };
      map[s.plan_id].revenue += plan.price;
      map[s.plan_id].count++;
    });
    return Object.values(map);
  }, [subscriptions, planMap]);

  const subsByRole = useMemo(() => {
    const map: Record<string, number> = {};
    subscriptions.forEach(s => {
      const plan = planMap[s.plan_id];
      if (!plan) return;
      map[plan.role] = (map[plan.role] || 0) + 1;
    });
    return Object.entries(map).map(([role, count]) => ({ name: role, value: count }));
  }, [subscriptions, planMap]);

  const totalMRR = revenueByPlan.reduce((s, r) => s + r.revenue, 0);

  // ---- ORDER DISTRIBUTION ----
  const orderSplit = [
    { name: "Rides", value: totalRides },
    { name: "Parcels", value: totalParcels },
    { name: "Food", value: totalFood },
  ].filter(o => o.value > 0);

  const rideStatusBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    rides.forEach(r => { map[r.status] = (map[r.status] || 0) + 1; });
    return Object.entries(map).map(([status, count]) => ({ status, count }));
  }, [rides]);

  const cancellationReasons = useMemo(() => {
    const map: Record<string, number> = {};
    rides.filter(r => r.cancellation_reason).forEach(r => {
      map[r.cancellation_reason] = (map[r.cancellation_reason] || 0) + 1;
    });
    return Object.entries(map).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [rides]);

  // ---- PERFORMANCE ----
  const topDrivers = useMemo(() => {
    const map: Record<string, number> = {};
    rides.filter(r => r.status === "completed" && r.driver_id).forEach(r => {
      map[r.driver_id] = (map[r.driver_id] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, count]) => {
      const driverRatings = rideRatings.filter(rt => rt.to_user_id === id);
      const avg = driverRatings.length > 0 ? (driverRatings.reduce((s, r) => s + r.rating, 0) / driverRatings.length).toFixed(1) : "N/A";
      return { name: id.slice(0, 8), rides: count, avgRating: avg };
    });
  }, [rides, rideRatings]);

  const topRestaurants = useMemo(() => {
    const map: Record<string, number> = {};
    foodOrders.forEach(o => { map[o.restaurant_id] = (map[o.restaurant_id] || 0) + 1; });
    const restNameMap = Object.fromEntries(restaurants.map(r => [r.id, r.name]));
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, count]) => {
      const rRatings = restRatings.filter(rt => rt.restaurant_id === id);
      const avg = rRatings.length > 0 ? (rRatings.reduce((s, r) => s + r.rating, 0) / rRatings.length).toFixed(1) : "N/A";
      return { name: restNameMap[id] || id.slice(0, 8), orders: count, avgRating: avg };
    });
  }, [foodOrders, restaurants, restRatings]);

  const topCities = useMemo(() => {
    const map: Record<string, number> = {};
    profiles.filter(p => p.city).forEach(p => { map[p.city] = (map[p.city] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([city, count]) => ({ city, users: count }));
  }, [profiles]);

  // ---- CSV EXPORT ----
  const exportCSV = () => {
    const rows = [
      ["Metric", "Value"],
      ["Total Rides", totalRides],
      ["Total Parcels", totalParcels],
      ["Total Food Orders", totalFood],
      ["Total Users", totalUsers],
      ["Active Drivers", activeDrivers],
      ["Active Restaurants", activeRestaurants],
      ["MAU", mau],
      ["Active Subscriptions", activeSubs],
      ["Completion Rate (%)", completionRate],
      ["Cancellation Rate (%)", cancellationRate],
      ["Avg Ride Rating", avgRideRating],
      ["Avg Restaurant Rating", avgRestRating],
      ["Total MRR (Rs)", totalMRR],
      [""],
      ["Top Drivers"],
      ["ID", "Completed Rides", "Avg Rating"],
      ...topDrivers.map(d => [d.name, d.rides, d.avgRating]),
      [""],
      ["Top Restaurants"],
      ["Name", "Orders", "Avg Rating"],
      ...topRestaurants.map(r => [r.name, r.orders, r.avgRating]),
      [""],
      ["Top Cities"],
      ["City", "Users"],
      ...topCities.map(c => [c.city, c.users]),
    ];
    const csv = rows.map(r => (Array.isArray(r) ? r : [r]).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `our-yatra-analytics-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <p className="text-muted-foreground p-6">Loading analytics...</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-foreground">Analytics & Reports</h2>
        <Button variant="outline" onClick={exportCSV} className="gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-2">
          {(["today", "7d", "30d", "90d"] as Preset[]).map(p => (
            <Button key={p} size="sm" variant={preset === p ? "default" : "outline"} onClick={() => handlePreset(p)}>
              {p === "today" ? "Today" : p === "7d" ? "7 Days" : p === "30d" ? "30 Days" : "90 Days"}
            </Button>
          ))}
          <div className="flex items-center gap-2 ml-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("gap-1", !customFrom && "text-muted-foreground")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {customFrom ? format(customFrom, "MMM dd") : "From"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("gap-1", !customTo && "text-muted-foreground")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {customTo ? format(customTo, "MMM dd") : "To"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customTo} onSelect={setCustomTo} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Button size="sm" onClick={applyCustomRange} disabled={!customFrom || !customTo}>Apply</Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards Row 1: Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Rides" value={totalRides} icon={Car} />
        <StatsCard title="Total Parcels" value={totalParcels} icon={Package} />
        <StatsCard title="Food Orders" value={totalFood} icon={UtensilsCrossed} />
        <StatsCard title="Total Users" value={totalUsers} icon={Users} />
      </div>

      {/* Summary Cards Row 2: Active */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Active Drivers" value={activeDrivers} icon={UserCheck} description="Currently online" />
        <StatsCard title="Active Restaurants" value={activeRestaurants} icon={Store} description="Currently open" />
        <StatsCard title="Monthly Active Users" value={mau} icon={Activity} />
        <StatsCard title="Active Subscriptions" value={activeSubs} icon={TrendingUp} />
      </div>

      {/* Summary Cards Row 3: Rates */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Completion Rate" value={`${completionRate}%`} icon={CheckCircle} />
        <StatsCard title="Cancellation Rate" value={`${cancellationRate}%`} icon={XCircle} />
        <StatsCard title="Avg Ride Rating" value={avgRideRating} icon={Star} />
        <StatsCard title="Avg Restaurant Rating" value={avgRestRating} icon={Star} />
      </div>

      {/* Growth Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Order Volume Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="rides" stackId="1" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.3} />
                <Area type="monotone" dataKey="parcels" stackId="1" stroke={COLORS[1]} fill={COLORS[1]} fillOpacity={0.3} />
                <Area type="monotone" dataKey="food" stackId="1" stroke={COLORS[2]} fill={COLORS[2]} fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">User Growth</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={userGrowthData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke={COLORS[3]} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Total MRR</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">Rs {totalMRR.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground mt-1">{activeSubs} active subscriptions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Revenue by Plan</CardTitle></CardHeader>
          <CardContent>
            {revenueByPlan.length === 0 ? <p className="text-sm text-muted-foreground">No data</p> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={revenueByPlan}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="revenue" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Subscribers by Role</CardTitle></CardHeader>
          <CardContent className="flex justify-center">
            {subsByRole.length === 0 ? <p className="text-sm text-muted-foreground">No data</p> : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={subsByRole} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {subsByRole.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Order Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Order Distribution</CardTitle></CardHeader>
          <CardContent className="flex justify-center">
            {orderSplit.length === 0 ? <p className="text-sm text-muted-foreground">No data</p> : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={orderSplit} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {orderSplit.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Rides by Status</CardTitle></CardHeader>
          <CardContent>
            {rideStatusBreakdown.length === 0 ? <p className="text-sm text-muted-foreground">No data</p> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={rideStatusBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="status" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {rideStatusBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Cancellation Reasons</CardTitle></CardHeader>
          <CardContent>
            {cancellationReasons.length === 0 ? <p className="text-sm text-muted-foreground">No cancellations with reasons</p> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={cancellationReasons} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="reason" tick={{ fontSize: 9 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="count" fill={COLORS[5]} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Top Drivers</CardTitle></CardHeader>
          <CardContent>
            {topDrivers.length === 0 ? <p className="text-sm text-muted-foreground">No data</p> : (
              <div className="space-y-3">
                {topDrivers.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-muted-foreground w-5">{i + 1}.</span>
                      <span className="font-medium text-foreground">{d.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span>{d.rides} rides</span>
                      <span className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-500 fill-amber-500" />{d.avgRating}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Top Restaurants</CardTitle></CardHeader>
          <CardContent>
            {topRestaurants.length === 0 ? <p className="text-sm text-muted-foreground">No data</p> : (
              <div className="space-y-3">
                {topRestaurants.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-muted-foreground w-5">{i + 1}.</span>
                      <span className="font-medium text-foreground">{r.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span>{r.orders} orders</span>
                      <span className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-500 fill-amber-500" />{r.avgRating}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Most Active Cities</CardTitle></CardHeader>
          <CardContent>
            {topCities.length === 0 ? <p className="text-sm text-muted-foreground">No city data</p> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topCities}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="city" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="users" fill={COLORS[4]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminAnalytics;
