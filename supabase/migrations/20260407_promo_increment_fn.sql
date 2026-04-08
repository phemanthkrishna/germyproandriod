CREATE OR REPLACE FUNCTION increment_promo_used(promo_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE promo_codes
  SET used_count = used_count + 1
  WHERE id = promo_id;
$$;
