insert into public.app_settings (key, value_bool)
values ('require_bus_operator_subscription', true)
on conflict (key) do nothing;
