-- Apply after the two legacy migrations. No destructive data reset.
BEGIN;
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='ADMIN');
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

-- Users cannot promote themselves by changing their public profile.
REVOKE UPDATE, INSERT, DELETE ON public.profiles FROM anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (merchant_name) ON public.profiles TO authenticated;
CREATE OR REPLACE FUNCTION public.prevent_profile_role_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND current_user NOT IN ('postgres','service_role','supabase_admin') THEN
    RAISE EXCEPTION 'Profile role is managed by the platform';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS profiles_protect_role ON public.profiles;
CREATE TRIGGER profiles_protect_role BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_change();

-- Account creation and profile creation share the same transaction.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE wanted_role text; merchant text;
BEGIN
  wanted_role := CASE WHEN NEW.raw_user_meta_data->>'role'='MERCHANT' THEN 'MERCHANT' ELSE 'USER' END;
  merchant := NULLIF(btrim(NEW.raw_user_meta_data->>'merchant_name'),'');
  IF wanted_role='MERCHANT' AND merchant IS NULL THEN wanted_role:='USER'; END IF;
  INSERT INTO public.profiles(id,role,merchant_name)
  VALUES(NEW.id,wanted_role,CASE WHEN wanted_role='MERCHANT' THEN left(merchant,255) ELSE NULL END)
  ON CONFLICT(id) DO NOTHING;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Payment state and prices are server-controlled, even when called via REST directly.
DROP POLICY IF EXISTS "System can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update all orders" ON public.orders;
REVOKE INSERT, UPDATE, DELETE ON public.orders FROM anon, authenticated;
GRANT SELECT ON public.orders TO authenticated;
-- No anonymous access to a SECURITY DEFINER analytics view or RPCs.
REVOKE ALL ON public.merchant_analytics FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_merchant_analytics(uuid,timestamptz,timestamptz,varchar) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_merchant_orders_overview(uuid,timestamptz,timestamptz,varchar,integer,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_merchant_products_performance(uuid,timestamptz,timestamptz,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_merchant_revenue_by_game(uuid,timestamptz,timestamptz,varchar) FROM PUBLIC, anon, authenticated;

-- Keep paid-order history when a product is removed.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_sku_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_sku_id_fkey FOREIGN KEY(sku_id) REFERENCES public.skus(id) ON DELETE RESTRICT;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_merchant_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_merchant_id_fkey FOREIGN KEY(merchant_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY(user_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS public.payment_events (
  event_id text PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.payment_events TO service_role;

-- Serialize transitions on the order row and persist the event in one transaction.
CREATE OR REPLACE FUNCTION public.apply_checkout_event(
 p_event_id text,p_order_id uuid,p_session_id text,p_status text,p_amount integer,p_currency text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target public.orders;
BEGIN
 SELECT * INTO target FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF target.stripe_checkout_session_id IS DISTINCT FROM p_session_id THEN RAISE EXCEPTION 'Session mismatch'; END IF;
 IF p_amount IS DISTINCT FROM target.amount OR p_currency IS DISTINCT FROM target.currency THEN RAISE EXCEPTION 'Payment amount or currency mismatch'; END IF;
 IF p_status NOT IN ('completed','failed') THEN RAISE EXCEPTION 'Unsupported status'; END IF;
 IF EXISTS(SELECT 1 FROM public.payment_events WHERE event_id=p_event_id) THEN RETURN; END IF;
 -- A paid order must never regress because of a delayed expiry event.
 IF target.status='pending' THEN
   UPDATE public.orders SET status=p_status WHERE id=p_order_id;
 END IF;
 INSERT INTO public.payment_events(event_id,order_id) VALUES(p_event_id,p_order_id);
END; $$;
REVOKE ALL ON FUNCTION public.apply_checkout_event(text,uuid,text,text,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_checkout_event(text,uuid,text,text,integer,text) TO service_role;
COMMIT;
