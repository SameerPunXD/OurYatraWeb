import {
  Home, Car, Package, UtensilsCrossed, CreditCard, User,
  Zap, Truck, DollarSign, ClipboardList, LayoutDashboard,
  Users, Settings, ShoppingBag, Bell, ShieldCheck,
  Clock, MapPin, Headphones, Star, FileText, History, Wrench, Bus,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export interface SidebarItem {
  title: string;
  url: string;
  icon: typeof Home;
}

export const rolePathMap: Record<AppRole, string> = {
  rider: "/rider",
  driver: "/driver",
  restaurant: "/restaurant",
  garage: "/garage",
  admin: "/admin",
  bus_operator: "/bus-operator",
};

export const sidebarConfig: Record<AppRole, SidebarItem[]> = {
  rider: [
    { title: "Home", url: "/rider", icon: Home },
    { title: "Book Ride", url: "/rider/book-ride", icon: Car },
    { title: "Buses", url: "/rider/buses", icon: Bus },
    { title: "Send Parcel", url: "/rider/send-parcel", icon: Package },
    { title: "My Parcels", url: "/rider/parcels", icon: Truck },
    { title: "Food Order", url: "/rider/food", icon: UtensilsCrossed },
    { title: "Food History", url: "/rider/food/history", icon: ShoppingBag },
    { title: "History", url: "/rider/history", icon: Clock },
    { title: "Saved Addresses", url: "/rider/addresses", icon: MapPin },
    { title: "Notifications", url: "/rider/notifications", icon: Bell },
    { title: "Support", url: "/rider/support", icon: Headphones },
    { title: "Profile", url: "/rider/profile", icon: User },
  ],
  driver: [
    { title: "Home", url: "/driver", icon: Home },
    { title: "Active Rides", url: "/driver/rides", icon: Zap },
    { title: "Deliveries", url: "/driver/deliveries", icon: Truck },
    { title: "Food Deliveries", url: "/driver/food-deliveries", icon: UtensilsCrossed },
    { title: "Garage Services", url: "/driver/garage", icon: Wrench },
    { title: "Garage Orders", url: "/driver/garage-orders", icon: ClipboardList },
    { title: "Ride History", url: "/driver/ride-history", icon: History },
    { title: "Parcel History", url: "/driver/parcel-history", icon: Clock },
    { title: "Food Delivery History", url: "/driver/food-delivery-history", icon: ShoppingBag },
    { title: "Earnings", url: "/driver/earnings", icon: DollarSign },
    { title: "Ratings", url: "/driver/ratings", icon: Star },
    { title: "Vehicle & Docs", url: "/driver/vehicle", icon: FileText },
    { title: "Notifications", url: "/driver/notifications", icon: Bell },
    { title: "Subscription", url: "/driver/subscription", icon: CreditCard },
    { title: "Support", url: "/driver/support", icon: Headphones },
    { title: "Profile", url: "/driver/profile", icon: User },
  ],
  restaurant: [
    { title: "Home", url: "/restaurant", icon: Home },
    { title: "Orders", url: "/restaurant/orders", icon: ClipboardList },
    { title: "Order History", url: "/restaurant/order-history", icon: History },
    { title: "Menu", url: "/restaurant/menu", icon: UtensilsCrossed },
    { title: "Reviews", url: "/restaurant/reviews", icon: Star },
    { title: "Analytics", url: "/restaurant/analytics", icon: DollarSign },
    { title: "Settings", url: "/restaurant/settings", icon: Settings },
    { title: "Notifications", url: "/restaurant/notifications", icon: Bell },
    { title: "Subscription", url: "/restaurant/subscription", icon: CreditCard },
    { title: "Profile", url: "/restaurant/profile", icon: User },
  ],
  garage: [
    { title: "Home", url: "/garage", icon: Home },
    { title: "Orders", url: "/garage/orders", icon: ClipboardList },
    { title: "Services", url: "/garage/services", icon: Wrench },
    { title: "Notifications", url: "/garage/notifications", icon: Bell },
    { title: "Subscription", url: "/garage/subscription", icon: CreditCard },
    { title: "Profile", url: "/garage/profile", icon: User },
  ],
  bus_operator: [
    { title: "Home", url: "/bus-operator", icon: Home },
    { title: "Manage Buses", url: "/bus-operator/buses", icon: Bus },
    { title: "Bookings", url: "/bus-operator/bookings", icon: ClipboardList },
    { title: "Notifications", url: "/bus-operator/notifications", icon: Bell },
    { title: "Subscription", url: "/bus-operator/subscription", icon: CreditCard },
    { title: "Profile", url: "/bus-operator/profile", icon: User },
  ],
  admin: [
    { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
    { title: "Users", url: "/admin/riders", icon: Users },
    { title: "Drivers", url: "/admin/drivers", icon: Car },
    { title: "Bus Operators", url: "/admin/bus-operators", icon: Bus },
    { title: "Buses", url: "/admin/buses", icon: ClipboardList },
    { title: "Restaurants", url: "/admin/restaurants", icon: UtensilsCrossed },
    { title: "Garages", url: "/admin/garages", icon: Wrench },
    { title: "Verification", url: "/admin/verification", icon: ShieldCheck },
    { title: "Rides", url: "/admin/rides", icon: Zap },
    { title: "Orders", url: "/admin/orders", icon: ShoppingBag },
    { title: "Parcels", url: "/admin/parcels", icon: Package },
    { title: "Subscriptions", url: "/admin/subscriptions", icon: CreditCard },
    { title: "Ratings", url: "/admin/ratings", icon: Star },
    { title: "Analytics", url: "/admin/analytics", icon: ClipboardList },
    { title: "Fraud", url: "/admin/fraud", icon: ShieldCheck },
    { title: "Notifications", url: "/admin/notifications", icon: Bell },
    { title: "Settings", url: "/admin/settings", icon: Settings },
  ],
};

export const roleLabelMap: Record<AppRole, string> = {
  rider: "User",
  driver: "Driver",
  restaurant: "Restaurant Partner",
  garage: "Garage Partner",
  bus_operator: "Bus Operator",
  admin: "Admin",
};
