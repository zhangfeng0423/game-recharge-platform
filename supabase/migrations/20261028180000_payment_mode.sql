BEGIN;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'unknown' CHECK(payment_mode IN ('unknown','test','live'));
UPDATE public.orders SET payment_mode='test' WHERE payment_mode='unknown' AND stripe_checkout_session_id LIKE 'cs_test_%';
UPDATE public.orders SET payment_mode='live' WHERE payment_mode='unknown' AND stripe_checkout_session_id LIKE 'cs_live_%';
DROP FUNCTION public.apply_checkout_event(text,uuid,text,text,integer,text);
CREATE OR REPLACE FUNCTION public.apply_checkout_event(
 p_event_id text,p_order_id uuid,p_session_id text,p_status text,p_amount integer,p_currency text,p_livemode boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target public.orders;
BEGIN
 SELECT * INTO target FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF target.stripe_checkout_session_id IS DISTINCT FROM p_session_id THEN RAISE EXCEPTION 'Session mismatch'; END IF;
 IF p_amount IS DISTINCT FROM target.amount OR p_currency IS DISTINCT FROM target.currency THEN RAISE EXCEPTION 'Payment amount or currency mismatch'; END IF;
 IF target.payment_mode IS DISTINCT FROM (CASE WHEN p_livemode THEN 'live' ELSE 'test' END) THEN RAISE EXCEPTION 'Payment mode mismatch'; END IF;
 IF p_status NOT IN ('completed','failed') THEN RAISE EXCEPTION 'Unsupported status'; END IF;
 IF EXISTS(SELECT 1 FROM public.payment_events WHERE event_id=p_event_id) THEN RETURN; END IF;
 -- A paid order must never regress because of a delayed expiry event.
 IF target.status='pending' THEN
   UPDATE public.orders SET status=p_status WHERE id=p_order_id;
 END IF;
 INSERT INTO public.payment_events(event_id,order_id) VALUES(p_event_id,p_order_id);
END; $$;
REVOKE ALL ON FUNCTION public.apply_checkout_event(text,uuid,text,text,integer,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_checkout_event(text,uuid,text,text,integer,text,boolean) TO service_role;

COMMIT;
