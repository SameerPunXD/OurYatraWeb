import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { FoodCartProvider } from "@/contexts/FoodCartContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AuthCallback from "./pages/AuthCallback";
import EsewaReturn from "./pages/EsewaReturn";

// Rider pages
import RiderDashboard from "./pages/rider/RiderDashboard";
import BookRide from "./pages/rider/BookRide";
import RiderParcels from "./pages/rider/RiderParcels";
import SendParcel from "./pages/rider/SendParcel";
import ParcelTracking from "./pages/rider/ParcelTracking";
import FoodOrder from "./pages/rider/FoodOrder";
import RestaurantDetail from "./pages/rider/RestaurantDetail";
import FoodCheckout from "./pages/rider/FoodCheckout";
import FoodOrderTracking from "./pages/rider/FoodOrderTracking";
import FoodOrderHistory from "./pages/rider/FoodOrderHistory";
import RiderHistory from "./pages/rider/RiderHistory";
import SavedAddresses from "./pages/rider/SavedAddresses";
import SupportPage from "./pages/rider/SupportPage";
import RiderBuses from "./pages/rider/RiderBuses";

// Driver pages
import DriverDashboard from "./pages/driver/DriverDashboard";
import DriverRides from "./pages/driver/DriverRides";
import DriverDeliveries from "./pages/driver/DriverDeliveries";
import DriverEarnings from "./pages/driver/DriverEarnings";
import DriverRideHistory from "./pages/driver/DriverRideHistory";
import DriverParcelHistory from "./pages/driver/DriverParcelHistory";
import DriverRatings from "./pages/driver/DriverRatings";
import DriverVehicle from "./pages/driver/DriverVehicle";
import DriverSupport from "./pages/driver/DriverSupport";
import DriverFoodDeliveries from "./pages/driver/DriverFoodDeliveries";
import DriverFoodDeliveryHistory from "./pages/driver/DriverFoodDeliveryHistory";
import DriverGarage from "./pages/driver/DriverGarage";
import DriverGarageOrders from "./pages/driver/DriverGarageOrders";

// Restaurant pages
import RestaurantDashboard from "./pages/restaurant/RestaurantDashboard";
import RestaurantOrders from "./pages/restaurant/RestaurantOrders";
import RestaurantMenu from "./pages/restaurant/RestaurantMenu";
import RestaurantReviews from "./pages/restaurant/RestaurantReviews";
import RestaurantAnalytics from "./pages/restaurant/RestaurantAnalytics";
import RestaurantSettings from "./pages/restaurant/RestaurantSettings";
import RestaurantOrderHistory from "./pages/restaurant/RestaurantOrderHistory";

// Garage pages
import GarageDashboard from "./pages/garage/GarageDashboard";
import GarageOrders from "./pages/garage/GarageOrders";
import GarageServices from "./pages/garage/GarageServices";

// Bus operator pages
import BusOperatorDashboard from "./pages/busOperator/BusOperatorDashboard";
import BusOperatorBuses from "./pages/busOperator/BusOperatorBuses";
import BusOperatorBookings from "./pages/busOperator/BusOperatorBookings";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminRiders from "./pages/admin/AdminRiders";
import AdminDrivers from "./pages/admin/AdminDrivers";
import AdminBusOperators from "./pages/admin/AdminBusOperators";
import AdminBuses from "./pages/admin/AdminBuses";
import AdminRestaurants from "./pages/admin/AdminRestaurants";
import AdminGarages from "./pages/admin/AdminGarages";
import AdminVerification from "./pages/admin/AdminVerification";
import AdminSubscriptions from "./pages/admin/AdminSubscriptions";
import AdminRides from "./pages/admin/AdminRides";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminParcels from "./pages/admin/AdminParcels";
import AdminRatings from "./pages/admin/AdminRatings";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminFraud from "./pages/admin/AdminFraud";
import AdminSettings from "./pages/admin/AdminSettings";

// Shared pages
import SubscriptionPage from "./pages/shared/SubscriptionPage";
import ProfilePage from "./pages/shared/ProfilePage";
import NotificationCenter from "./pages/shared/NotificationCenter";

const queryClient = new QueryClient();

const App = () => {
  console.log("App component checks", JSON.stringify({
    Toaster: typeof Toaster,
    Sonner: typeof Sonner,
    TooltipProvider: typeof TooltipProvider,
    BrowserRouter: typeof BrowserRouter,
    AuthProvider: typeof AuthProvider,
    FoodCartProvider: typeof FoodCartProvider,
    DashboardLayout: typeof DashboardLayout,
    ProtectedRoute: typeof ProtectedRoute,
    AdminOrders: typeof AdminOrders,
    AdminParcels: typeof AdminParcels,
    AdminRatings: typeof AdminRatings,
    AuthCallback: typeof AuthCallback,
  }));

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <FoodCartProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/payment/esewa/return" element={<EsewaReturn />} />

            {/* User dashboard */}
            <Route path="/rider" element={<ProtectedRoute requiredRole="rider"><DashboardLayout title="User" /></ProtectedRoute>}>
              <Route index element={<RiderDashboard />} />
              <Route path="book-ride" element={<BookRide />} />
              <Route path="buses" element={<RiderBuses />} />
              <Route path="parcels" element={<RiderParcels />} />
              <Route path="parcels/:id" element={<ParcelTracking />} />
              <Route path="send-parcel" element={<SendParcel />} />
              <Route path="food" element={<FoodOrder />} />
              <Route path="food/restaurant/:id" element={<RestaurantDetail />} />
              <Route path="food/checkout" element={<FoodCheckout />} />
              <Route path="food/order/:id" element={<FoodOrderTracking />} />
              <Route path="food/history" element={<FoodOrderHistory />} />
              <Route path="history" element={<RiderHistory />} />
              <Route path="addresses" element={<SavedAddresses />} />
              <Route path="support" element={<SupportPage />} />
              <Route path="notifications" element={<NotificationCenter />} />
              <Route path="subscription" element={<SubscriptionPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>

            {/* Driver dashboard */}
            <Route path="/driver" element={<ProtectedRoute requiredRole="driver"><DashboardLayout title="Driver" /></ProtectedRoute>}>
              <Route index element={<DriverDashboard />} />
              <Route path="rides" element={<DriverRides />} />
              <Route path="deliveries" element={<DriverDeliveries />} />
              <Route path="food-deliveries" element={<DriverFoodDeliveries />} />
              <Route path="garage" element={<DriverGarage />} />
              <Route path="garage-orders" element={<DriverGarageOrders />} />
              <Route path="ride-history" element={<DriverRideHistory />} />
              <Route path="parcel-history" element={<DriverParcelHistory />} />
              <Route path="food-delivery-history" element={<DriverFoodDeliveryHistory />} />
              <Route path="earnings" element={<DriverEarnings />} />
              <Route path="ratings" element={<DriverRatings />} />
              <Route path="vehicle" element={<DriverVehicle />} />
              <Route path="support" element={<DriverSupport />} />
              <Route path="notifications" element={<NotificationCenter />} />
              <Route path="subscription" element={<SubscriptionPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>

            {/* Restaurant dashboard */}
            <Route path="/restaurant" element={<ProtectedRoute requiredRole="restaurant"><DashboardLayout title="Restaurant" /></ProtectedRoute>}>
              <Route index element={<RestaurantDashboard />} />
              <Route path="orders" element={<RestaurantOrders />} />
              <Route path="order-history" element={<RestaurantOrderHistory />} />
              <Route path="menu" element={<RestaurantMenu />} />
              <Route path="reviews" element={<RestaurantReviews />} />
              <Route path="analytics" element={<RestaurantAnalytics />} />
              <Route path="settings" element={<RestaurantSettings />} />
              <Route path="notifications" element={<NotificationCenter />} />
              <Route path="subscription" element={<SubscriptionPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>

            {/* Garage dashboard */}
            <Route path="/garage" element={<ProtectedRoute requiredRole="garage"><DashboardLayout title="Garage" /></ProtectedRoute>}>
              <Route index element={<GarageDashboard />} />
              <Route path="orders" element={<GarageOrders />} />
              <Route path="services" element={<GarageServices />} />
              <Route path="notifications" element={<NotificationCenter />} />
              <Route path="subscription" element={<SubscriptionPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>

            {/* Bus operator dashboard */}
            <Route path="/bus-operator" element={<ProtectedRoute requiredRole="bus_operator"><DashboardLayout title="Bus Operator" /></ProtectedRoute>}>
              <Route index element={<BusOperatorDashboard />} />
              <Route path="buses" element={<BusOperatorBuses />} />
              <Route path="bookings" element={<BusOperatorBookings />} />
              <Route path="notifications" element={<NotificationCenter />} />
              <Route path="subscription" element={<SubscriptionPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>

            {/* Admin dashboard */}
            <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><DashboardLayout title="Admin" /></ProtectedRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="riders" element={<AdminRiders />} />
              <Route path="drivers" element={<AdminDrivers />} />
              <Route path="bus-operators" element={<AdminBusOperators />} />
              <Route path="buses" element={<AdminBuses />} />
              <Route path="restaurants" element={<AdminRestaurants />} />
              <Route path="garages" element={<AdminGarages />} />
              <Route path="verification" element={<AdminVerification />} />
              <Route path="subscriptions" element={<AdminSubscriptions />} />
              <Route path="rides" element={<AdminRides />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="parcels" element={<AdminParcels />} />
              <Route path="ratings" element={<AdminRatings />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="fraud" element={<AdminFraud />} />
              <Route path="notifications" element={<NotificationCenter />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          </FoodCartProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
