
-- ============================================
-- Fix ALL RLS policies: drop RESTRICTIVE, recreate as PERMISSIVE
-- ============================================

-- ===== profiles =====
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ===== user_roles =====
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ===== rides =====
DROP POLICY IF EXISTS "Riders can view own rides" ON public.rides;
DROP POLICY IF EXISTS "Riders can create rides" ON public.rides;
DROP POLICY IF EXISTS "Riders can cancel own pending rides" ON public.rides;
DROP POLICY IF EXISTS "Drivers can view assigned rides" ON public.rides;
DROP POLICY IF EXISTS "Drivers can view pending rides" ON public.rides;
DROP POLICY IF EXISTS "Drivers can update assigned rides" ON public.rides;
DROP POLICY IF EXISTS "Admins can view all rides" ON public.rides;
DROP POLICY IF EXISTS "Admins can manage rides" ON public.rides;

CREATE POLICY "Riders can view own rides" ON public.rides FOR SELECT TO authenticated USING (auth.uid() = rider_id);
CREATE POLICY "Riders can create rides" ON public.rides FOR INSERT TO authenticated WITH CHECK (auth.uid() = rider_id);
CREATE POLICY "Riders can cancel own pending rides" ON public.rides FOR UPDATE TO authenticated USING (auth.uid() = rider_id AND status = 'pending'::ride_status);
CREATE POLICY "Drivers can view assigned rides" ON public.rides FOR SELECT TO authenticated USING (auth.uid() = driver_id);
CREATE POLICY "Drivers can view pending rides" ON public.rides FOR SELECT TO authenticated USING (status = 'pending'::ride_status AND has_role(auth.uid(), 'driver'::app_role));
CREATE POLICY "Drivers can update assigned rides" ON public.rides FOR UPDATE TO authenticated USING (auth.uid() = driver_id OR (status = 'pending'::ride_status AND has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Admins can view all rides" ON public.rides FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage rides" ON public.rides FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ===== parcels =====
DROP POLICY IF EXISTS "Senders can view own parcels" ON public.parcels;
DROP POLICY IF EXISTS "Senders can create parcels" ON public.parcels;
DROP POLICY IF EXISTS "Senders can cancel own pending parcels" ON public.parcels;
DROP POLICY IF EXISTS "Drivers can view assigned parcels" ON public.parcels;
DROP POLICY IF EXISTS "Drivers can view pending parcels" ON public.parcels;
DROP POLICY IF EXISTS "Drivers can update assigned parcels" ON public.parcels;
DROP POLICY IF EXISTS "Admins can view all parcels" ON public.parcels;
DROP POLICY IF EXISTS "Admins can manage parcels" ON public.parcels;

CREATE POLICY "Senders can view own parcels" ON public.parcels FOR SELECT TO authenticated USING (auth.uid() = sender_id);
CREATE POLICY "Senders can create parcels" ON public.parcels FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Senders can cancel own pending parcels" ON public.parcels FOR UPDATE TO authenticated USING (auth.uid() = sender_id AND status = 'pending'::parcel_status);
CREATE POLICY "Drivers can view assigned parcels" ON public.parcels FOR SELECT TO authenticated USING (auth.uid() = driver_id);
CREATE POLICY "Drivers can view pending parcels" ON public.parcels FOR SELECT TO authenticated USING (status = 'pending'::parcel_status AND has_role(auth.uid(), 'driver'::app_role));
CREATE POLICY "Drivers can update assigned parcels" ON public.parcels FOR UPDATE TO authenticated USING (auth.uid() = driver_id OR (status = 'pending'::parcel_status AND has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Admins can view all parcels" ON public.parcels FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage parcels" ON public.parcels FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ===== food_orders =====
DROP POLICY IF EXISTS "Customers can view own orders" ON public.food_orders;
DROP POLICY IF EXISTS "Customers can create orders" ON public.food_orders;
DROP POLICY IF EXISTS "Customers can cancel own pending orders" ON public.food_orders;
DROP POLICY IF EXISTS "Restaurant owners can view orders" ON public.food_orders;
DROP POLICY IF EXISTS "Restaurant owners can update orders" ON public.food_orders;
DROP POLICY IF EXISTS "Drivers can view assigned food orders" ON public.food_orders;
DROP POLICY IF EXISTS "Drivers can update assigned food orders" ON public.food_orders;
DROP POLICY IF EXISTS "Admins can view all food orders" ON public.food_orders;
DROP POLICY IF EXISTS "Admins can manage food orders" ON public.food_orders;

CREATE POLICY "Customers can view own orders" ON public.food_orders FOR SELECT TO authenticated USING (auth.uid() = customer_id);
CREATE POLICY "Customers can create orders" ON public.food_orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Customers can cancel own pending orders" ON public.food_orders FOR UPDATE TO authenticated USING (auth.uid() = customer_id AND status = 'pending'::food_order_status);
CREATE POLICY "Restaurant owners can view orders" ON public.food_orders FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM restaurants WHERE restaurants.id = food_orders.restaurant_id AND restaurants.owner_id = auth.uid()));
CREATE POLICY "Restaurant owners can update orders" ON public.food_orders FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM restaurants WHERE restaurants.id = food_orders.restaurant_id AND restaurants.owner_id = auth.uid()));
CREATE POLICY "Drivers can view assigned food orders" ON public.food_orders FOR SELECT TO authenticated USING (auth.uid() = driver_id);
CREATE POLICY "Drivers can update assigned food orders" ON public.food_orders FOR UPDATE TO authenticated USING (auth.uid() = driver_id);
CREATE POLICY "Admins can view all food orders" ON public.food_orders FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage food orders" ON public.food_orders FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ===== restaurants =====
DROP POLICY IF EXISTS "Anyone can view restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Owners can manage own restaurant" ON public.restaurants;
DROP POLICY IF EXISTS "Admins can manage restaurants" ON public.restaurants;

CREATE POLICY "Anyone can view restaurants" ON public.restaurants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can manage own restaurant" ON public.restaurants FOR ALL TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Admins can manage restaurants" ON public.restaurants FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ===== menu_items =====
DROP POLICY IF EXISTS "Anyone can view available menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Restaurant owners can manage menu" ON public.menu_items;
DROP POLICY IF EXISTS "Admins can manage menu items" ON public.menu_items;

CREATE POLICY "Anyone can view available menu items" ON public.menu_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Restaurant owners can manage menu" ON public.menu_items FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM restaurants WHERE restaurants.id = menu_items.restaurant_id AND restaurants.owner_id = auth.uid()));
CREATE POLICY "Admins can manage menu items" ON public.menu_items FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ===== driver_profiles =====
DROP POLICY IF EXISTS "Owner can read own driver profile" ON public.driver_profiles;
DROP POLICY IF EXISTS "Owner can insert own driver profile" ON public.driver_profiles;
DROP POLICY IF EXISTS "Owner can update own driver profile" ON public.driver_profiles;
DROP POLICY IF EXISTS "Admin can read all driver profiles" ON public.driver_profiles;
DROP POLICY IF EXISTS "Admin can manage driver profiles" ON public.driver_profiles;

CREATE POLICY "Owner can read own driver profile" ON public.driver_profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Owner can insert own driver profile" ON public.driver_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Owner can update own driver profile" ON public.driver_profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admin can read all driver profiles" ON public.driver_profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can manage driver profiles" ON public.driver_profiles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ===== ratings =====
DROP POLICY IF EXISTS "Users can insert own ratings" ON public.ratings;
DROP POLICY IF EXISTS "Users can read own sent ratings" ON public.ratings;
DROP POLICY IF EXISTS "Users can read received ratings" ON public.ratings;
DROP POLICY IF EXISTS "Restaurant owners can read restaurant ratings" ON public.ratings;
DROP POLICY IF EXISTS "Admin can read all ratings" ON public.ratings;

CREATE POLICY "Users can insert own ratings" ON public.ratings FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "Users can read own sent ratings" ON public.ratings FOR SELECT TO authenticated USING (auth.uid() = from_user_id);
CREATE POLICY "Users can read received ratings" ON public.ratings FOR SELECT TO authenticated USING (auth.uid() = to_user_id);
CREATE POLICY "Restaurant owners can read restaurant ratings" ON public.ratings FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM restaurants WHERE restaurants.id = ratings.restaurant_id AND restaurants.owner_id = auth.uid()));
CREATE POLICY "Admin can read all ratings" ON public.ratings FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ===== chat_messages =====
DROP POLICY IF EXISTS "Authenticated can insert own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Authenticated can read messages" ON public.chat_messages;

CREATE POLICY "Authenticated can insert own messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Authenticated can read messages" ON public.chat_messages FOR SELECT TO authenticated USING (true);

-- ===== notifications =====
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admin can read all notifications" ON public.notifications;

CREATE POLICY "Users can read own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admin can read all notifications" ON public.notifications FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ===== subscription_plans =====
DROP POLICY IF EXISTS "Anyone can view active plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Admins can manage plans" ON public.subscription_plans;

CREATE POLICY "Anyone can view active plans" ON public.subscription_plans FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Admins can manage plans" ON public.subscription_plans FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ===== subscriptions =====
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.subscriptions;

CREATE POLICY "Users can view own subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscriptions" ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subscriptions" ON public.subscriptions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
