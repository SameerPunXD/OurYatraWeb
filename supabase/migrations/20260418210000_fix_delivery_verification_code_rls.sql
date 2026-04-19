ALTER FUNCTION public.ensure_delivery_verification_code(
  public.delivery_verification_target,
  uuid,
  uuid
) SECURITY DEFINER;

ALTER FUNCTION public.invalidate_delivery_verification_code(
  public.delivery_verification_target,
  uuid
) SECURITY DEFINER;

ALTER FUNCTION public.require_verified_delivery_code(
  public.delivery_verification_target,
  uuid
) SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.generate_delivery_verification_code() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_delivery_verification_code(
  public.delivery_verification_target,
  uuid,
  uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invalidate_delivery_verification_code(
  public.delivery_verification_target,
  uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.require_verified_delivery_code(
  public.delivery_verification_target,
  uuid
) FROM PUBLIC;
