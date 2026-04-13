INSERT INTO public.subscription_plans (name, price, role, features, is_active)
SELECT
  'Garage Basic',
  1999,
  'garage'::public.app_role,
  '["List unlimited garage services","Receive driver repair requests","Realtime order tracking & chat"]'::jsonb,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscription_plans WHERE role = 'garage'::public.app_role
);
