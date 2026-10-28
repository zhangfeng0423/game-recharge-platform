BEGIN;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS player_account varchar(128);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS game_server varchar(128);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfillment_status text NOT NULL DEFAULT 'pending' CHECK(fulfillment_status IN ('pending','fulfilled','attention'));
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfilled_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfilled_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfillment_note varchar(1000);
CREATE TABLE IF NOT EXISTS public.fulfillment_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 status text NOT NULL CHECK(status IN ('fulfilled','attention')),
 note varchar(1000) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fulfillment_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fulfillment_events FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.fulfillment_events TO service_role;
CREATE OR REPLACE FUNCTION public.set_order_fulfillment(p_order_id uuid,p_status text,p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target public.orders; caller uuid; caller_role text;
BEGIN
 caller:=auth.uid();
 SELECT role INTO caller_role FROM public.profiles WHERE id=caller;
 IF caller IS NULL OR caller_role NOT IN ('MERCHANT','ADMIN') THEN RAISE EXCEPTION 'Merchant access required'; END IF;
 SELECT * INTO target FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR (caller_role!='ADMIN' AND target.merchant_id!=caller) THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF target.status!='completed' THEN RAISE EXCEPTION 'Payment must be confirmed before fulfillment'; END IF;
 IF p_status NOT IN ('fulfilled','attention') OR p_status IS NULL THEN RAISE EXCEPTION 'Invalid fulfillment status'; END IF;
 IF p_note IS NULL OR length(btrim(p_note))=0 OR length(p_note)>1000 THEN RAISE EXCEPTION 'Delivery note is required'; END IF;
 IF target.fulfillment_status='fulfilled' THEN
   IF p_status='fulfilled' THEN RETURN; END IF;
   RAISE EXCEPTION 'Delivered orders cannot regress';
 END IF;
 UPDATE public.orders SET fulfillment_status=p_status,fulfillment_note=btrim(p_note),
   fulfilled_at=CASE WHEN p_status='fulfilled' THEN now() ELSE NULL END,
   fulfilled_by=CASE WHEN p_status='fulfilled' THEN caller ELSE NULL END WHERE id=p_order_id;
 INSERT INTO public.fulfillment_events(order_id,actor_id,status,note) VALUES(p_order_id,caller,p_status,btrim(p_note));
END; $$;
REVOKE ALL ON FUNCTION public.set_order_fulfillment(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_order_fulfillment(uuid,text,text) TO authenticated;
COMMIT;
