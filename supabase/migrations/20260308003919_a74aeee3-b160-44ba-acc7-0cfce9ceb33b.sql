-- Create enum for ride status
CREATE TYPE public.ride_status AS ENUM ('pending', 'accepted', 'in_progress', 'completed', 'cancelled');

-- Create enum for parcel status
CREATE TYPE public.parcel_status AS ENUM ('pending', 'picked_up', 'in_transit', 'delivered', 'cancelled');

-- Create enum for food order status
CREATE TYPE public.food_order_status AS ENUM ('pending', 'confirmed', 'preparing', 'ready', 'picked_up', 'delivered', 'cancelled');

-- Rides table
CREATE TABLE public.rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES auth.users(id),
  pickup_location TEXT NOT NULL,
  pickup_lat DOUBLE PRECISION,
  pickup_lng DOUBLE PRECISION,
  dropoff_location TEXT NOT NULL,
  dropoff_lat DOUBLE PRECISION,
  dropoff_lng DOUBLE PRECISION,
  fare NUMERIC(10,2),
  distance_km NUMERIC(10,2),
  status ride_status NOT NULL DEFAULT 'pending',
  vehicle_type TEXT DEFAULT 'car',
  notes TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Parcels table
CREATE TABLE public.parcels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES auth.users(id),
  pickup_location TEXT NOT NULL,
  pickup_lat DOUBLE PRECISION,
  pickup_lng DOUBLE PRECISION,
  dropoff_location TEXT NOT NULL,
  dropoff_lat DOUBLE PRECISION,
  dropoff_lng DOUBLE PRECISION,
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  package_description TEXT,
  weight_kg NUMERIC(10,2),
  fare NUMERIC(10,2),
  status parcel_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  picked_up_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Restaurants table
CREATE TABLE public.restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT NOT NULL,
  phone TEXT,
  image_url TEXT,
  cuisine_type TEXT,
  is_open BOOLEAN NOT NULL DEFAULT false,
  opening_time TIME,
  closing_time TIME,
  rating NUMERIC(2,1) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Menu items table
CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  image_url TEXT,
  category TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Food orders table
CREATE TABLE public.food_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id),
  driver_id UUID REFERENCES auth.users(id),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount NUMERIC(10,2) NOT NULL,
  delivery_fee NUMERIC(10,2) DEFAULT 0,
  delivery_address TEXT NOT NULL,
  delivery_lat DOUBLE PRECISION,
  delivery_lng DOUBLE PRECISION,
  status food_order_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  estimated_delivery_time TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_orders ENABLE ROW LEVEL SECURITY;

-- Rides RLS
CREATE POLICY "Riders can view own rides" ON public.rides FOR SELECT USING (auth.uid() = rider_id);
CREATE POLICY "Riders can create rides" ON public.rides FOR INSERT WITH CHECK (auth.uid() = rider_id);
CREATE POLICY "Drivers can view assigned rides" ON public.rides FOR SELECT USING (auth.uid() = driver_id);
CREATE POLICY "Drivers can view pending rides" ON public.rides FOR SELECT USING (status = 'pending' AND public.has_role(auth.uid(), 'driver'));
CREATE POLICY "Drivers can update assigned rides" ON public.rides FOR UPDATE USING (auth.uid() = driver_id);
CREATE POLICY "Admins can view all rides" ON public.rides FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage rides" ON public.rides FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Parcels RLS
CREATE POLICY "Senders can view own parcels" ON public.parcels FOR SELECT USING (auth.uid() = sender_id);
CREATE POLICY "Senders can create parcels" ON public.parcels FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Drivers can view assigned parcels" ON public.parcels FOR SELECT USING (auth.uid() = driver_id);
CREATE POLICY "Drivers can view pending parcels" ON public.parcels FOR SELECT USING (status = 'pending' AND public.has_role(auth.uid(), 'driver'));
CREATE POLICY "Drivers can update assigned parcels" ON public.parcels FOR UPDATE USING (auth.uid() = driver_id);
CREATE POLICY "Admins can view all parcels" ON public.parcels FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage parcels" ON public.parcels FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Restaurants RLS
CREATE POLICY "Anyone can view restaurants" ON public.restaurants FOR SELECT USING (true);
CREATE POLICY "Owners can manage own restaurant" ON public.restaurants FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Admins can manage restaurants" ON public.restaurants FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Menu items RLS
CREATE POLICY "Anyone can view available menu items" ON public.menu_items FOR SELECT USING (true);
CREATE POLICY "Restaurant owners can manage menu" ON public.menu_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.restaurants WHERE id = menu_items.restaurant_id AND owner_id = auth.uid())
);
CREATE POLICY "Admins can manage menu items" ON public.menu_items FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Food orders RLS
CREATE POLICY "Customers can view own orders" ON public.food_orders FOR SELECT USING (auth.uid() = customer_id);
CREATE POLICY "Customers can create orders" ON public.food_orders FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Restaurant owners can view orders" ON public.food_orders FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.restaurants WHERE id = food_orders.restaurant_id AND owner_id = auth.uid())
);
CREATE POLICY "Restaurant owners can update orders" ON public.food_orders FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.restaurants WHERE id = food_orders.restaurant_id AND owner_id = auth.uid())
);
CREATE POLICY "Drivers can view assigned food orders" ON public.food_orders FOR SELECT USING (auth.uid() = driver_id);
CREATE POLICY "Drivers can update assigned food orders" ON public.food_orders FOR UPDATE USING (auth.uid() = driver_id);
CREATE POLICY "Admins can view all food orders" ON public.food_orders FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage food orders" ON public.food_orders FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Updated_at triggers
CREATE TRIGGER update_rides_updated_at BEFORE UPDATE ON public.rides FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_parcels_updated_at BEFORE UPDATE ON public.parcels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_food_orders_updated_at BEFORE UPDATE ON public.food_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();