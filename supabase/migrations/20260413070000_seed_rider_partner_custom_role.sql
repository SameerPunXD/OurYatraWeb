-- Separate bike/scooter partner signup from four-wheeler driver signup.
INSERT INTO public.custom_roles (slug, label, base_role, is_active)
VALUES ('rider_partner', 'Rider Partner', 'driver', true)
ON CONFLICT (slug) DO UPDATE
SET label = EXCLUDED.label,
    base_role = EXCLUDED.base_role,
    is_active = EXCLUDED.is_active;
