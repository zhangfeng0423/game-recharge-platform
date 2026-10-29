BEGIN;

-- 1. Games table extensions
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general';

-- 2. SKUs table extensions & Idempotent One-Time Legacy Backfill
ALTER TABLE public.skus ADD COLUMN IF NOT EXISTS external_url text;
ALTER TABLE public.skus ADD COLUMN IF NOT EXISTS requires_recipient_info boolean NOT NULL DEFAULT false;
ALTER TABLE public.skus ADD COLUMN IF NOT EXISTS recipient_label jsonb DEFAULT '{"en": "Recipient / Account Info", "zh": "接收账号 / 备注信息"}'::jsonb;
ALTER TABLE public.skus ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;

-- Idempotent one-time backfill: only runs when delivery_mode column is first created. Never overwrites configured values on replay.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'skus' AND column_name = 'delivery_mode'
  ) THEN
    ALTER TABLE public.skus ADD COLUMN delivery_mode text NOT NULL DEFAULT 'auto' CHECK (delivery_mode IN ('auto', 'manual', 'showcase'));
    UPDATE public.skus SET delivery_mode = 'manual', requires_recipient_info = true;
  END IF;
END $$;

-- RLS: Public/anon can only view published SKUs; merchants can view all SKUs for their games
ALTER TABLE public.skus ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone can view SKUs" ON public.skus;
DROP POLICY IF EXISTS "Public can view skus" ON public.skus;
DROP POLICY IF EXISTS "skus_public_select" ON public.skus;
CREATE POLICY "skus_public_select" ON public.skus
  FOR SELECT TO PUBLIC
  USING (
    (is_published = true AND EXISTS (
      SELECT 1 FROM public.games g WHERE g.id = skus.game_id AND g.is_published = true
    ))
    OR (auth.uid() IS NOT NULL AND (
      EXISTS (SELECT 1 FROM public.games g WHERE g.id = skus.game_id AND g.merchant_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
    ))
  );

-- 3. SKU Fulfillment Secrets table (P0 Isolation of secret keys, links, and auto-delivery content)
CREATE TABLE IF NOT EXISTS public.sku_fulfillment_secrets (
  sku_id uuid PRIMARY KEY REFERENCES public.skus(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(btrim(content)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Backfill from legacy skus.auto_delivery_content if column existed before dropping
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'skus' AND column_name = 'auto_delivery_content'
  ) THEN
    INSERT INTO public.sku_fulfillment_secrets (sku_id, content)
    SELECT id, btrim(auto_delivery_content)
    FROM public.skus
    WHERE auto_delivery_content IS NOT NULL AND char_length(btrim(auto_delivery_content)) > 0
    ON CONFLICT (sku_id) DO UPDATE SET content = EXCLUDED.content;

    ALTER TABLE public.skus DROP COLUMN auto_delivery_content;
  END IF;
END $$;

ALTER TABLE public.sku_fulfillment_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sku_fulfillment_secrets FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sku_fulfillment_secrets TO authenticated;
GRANT ALL ON public.sku_fulfillment_secrets TO service_role;

DROP POLICY IF EXISTS "sku_fulfillment_secrets_merchant_rw" ON public.sku_fulfillment_secrets;
CREATE POLICY "sku_fulfillment_secrets_merchant_rw" ON public.sku_fulfillment_secrets
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.skus s
      JOIN public.games g ON s.game_id = g.id
      WHERE s.id = sku_fulfillment_secrets.sku_id
        AND (g.merchant_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.skus s
      JOIN public.games g ON s.game_id = g.id
      WHERE s.id = sku_fulfillment_secrets.sku_id
        AND (g.merchant_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN'))
    )
  );

-- Atomic SKU and secret save RPC to ensure transactional consistency
CREATE OR REPLACE FUNCTION public.save_sku_with_secret(
  p_id uuid,
  p_game_id uuid,
  p_name jsonb,
  p_description jsonb,
  p_prices jsonb,
  p_image_url text,
  p_delivery_mode text,
  p_external_url text,
  p_requires_recipient_info boolean,
  p_recipient_label jsonb,
  p_is_published boolean,
  p_secret_content text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_game_owner uuid;
  v_is_admin boolean := false;
  v_sku_id uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT role = 'ADMIN' INTO v_is_admin
  FROM public.profiles
  WHERE id = v_caller AND role IN ('MERCHANT', 'ADMIN');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  -- Verify game exists and caller owns it (or is admin)
  SELECT merchant_id INTO v_game_owner FROM public.games WHERE id = p_game_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GAME_NOT_FOUND';
  END IF;

  IF v_is_admin IS NOT TRUE AND v_game_owner IS DISTINCT FROM v_caller THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  IF p_delivery_mode NOT IN ('auto', 'manual', 'showcase') THEN
    RAISE EXCEPTION 'INVALID_DELIVERY_MODE';
  END IF;

  IF p_delivery_mode = 'auto' AND (p_secret_content IS NULL OR length(btrim(p_secret_content)) = 0) THEN
    RAISE EXCEPTION 'DELIVERY_CONTENT_REQUIRED';
  END IF;

  IF p_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.skus WHERE id = p_id) THEN
    SELECT id INTO v_sku_id FROM public.skus WHERE id = p_id AND game_id = p_game_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'SKU_NOT_FOUND';
    END IF;

    UPDATE public.skus SET
      name = p_name,
      description = p_description,
      prices = p_prices,
      image_url = p_image_url,
      delivery_mode = p_delivery_mode,
      external_url = p_external_url,
      requires_recipient_info = COALESCE(p_requires_recipient_info, false),
      recipient_label = COALESCE(p_recipient_label, '{"en": "Recipient / Account Info", "zh": "接收账号 / 备注信息"}'::jsonb),
      is_published = COALESCE(p_is_published, true),
      updated_at = now()
    WHERE id = p_id;
    v_sku_id := p_id;
  ELSE
    INSERT INTO public.skus (
      id,
      game_id,
      name,
      description,
      prices,
      image_url,
      delivery_mode,
      external_url,
      requires_recipient_info,
      recipient_label,
      is_published
    ) VALUES (
      COALESCE(p_id, gen_random_uuid()),
      p_game_id,
      p_name,
      p_description,
      p_prices,
      p_image_url,
      p_delivery_mode,
      p_external_url,
      COALESCE(p_requires_recipient_info, false),
      COALESCE(p_recipient_label, '{"en": "Recipient / Account Info", "zh": "接收账号 / 备注信息"}'::jsonb),
      COALESCE(p_is_published, true)
    ) RETURNING id INTO v_sku_id;
  END IF;

  IF p_delivery_mode = 'auto' THEN
    INSERT INTO public.sku_fulfillment_secrets (sku_id, content, updated_at)
    VALUES (v_sku_id, btrim(p_secret_content), now())
    ON CONFLICT (sku_id) DO UPDATE SET
      content = EXCLUDED.content,
      updated_at = now();
  ELSE
    DELETE FROM public.sku_fulfillment_secrets WHERE sku_id = v_sku_id;
  END IF;

  RETURN v_sku_id;
END; $$;

REVOKE ALL ON FUNCTION public.save_sku_with_secret(uuid, uuid, jsonb, jsonb, jsonb, text, text, text, boolean, jsonb, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_sku_with_secret(uuid, uuid, jsonb, jsonb, jsonb, text, text, text, boolean, jsonb, boolean, text) TO authenticated, service_role;

-- 4. Orders table extensions for guest checkout and redeem codes
ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS buyer_email text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS access_token uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS redeem_code_id uuid;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_mode_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_mode_check CHECK (payment_mode IN ('unknown', 'test', 'live', 'redeem'));

-- 5. Redeem codes table
CREATE TABLE IF NOT EXISTS public.redeem_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (char_length(trim(code)) BETWEEN 6 AND 64),
  sku_id uuid NOT NULL REFERENCES public.skus(id) ON DELETE RESTRICT,
  merchant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  batch_note text,
  custom_delivery_content text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'disabled')),
  redeemed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  redeemed_by_email text,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  expires_at timestamptz,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_redeem_code_id_fkey') THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_redeem_code_id_fkey FOREIGN KEY (redeem_code_id) REFERENCES public.redeem_codes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enforce that code merchant_id must match the SKU's owner game merchant_id
CREATE OR REPLACE FUNCTION public.check_redeem_code_merchant() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT g.merchant_id INTO v_owner
  FROM public.skus s
  JOIN public.games g ON s.game_id = g.id
  WHERE s.id = NEW.sku_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SKU_NOT_FOUND';
  END IF;
  IF NEW.merchant_id != v_owner THEN
    RAISE EXCEPTION 'MERCHANT_SKU_MISMATCH';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS tr_check_redeem_code_merchant ON public.redeem_codes;
CREATE TRIGGER tr_check_redeem_code_merchant
  BEFORE INSERT OR UPDATE OF sku_id, merchant_id ON public.redeem_codes
  FOR EACH ROW EXECUTE FUNCTION public.check_redeem_code_merchant();

-- Clean up ALL previous privileges and policies on redeem_codes
ALTER TABLE public.redeem_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.redeem_codes FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "redeem_codes_owner_write" ON public.redeem_codes;
DROP POLICY IF EXISTS "redeem_codes_owner_all" ON public.redeem_codes;
DROP POLICY IF EXISTS "redeem_codes_merchant_all" ON public.redeem_codes;
DROP POLICY IF EXISTS "redeem_codes_merchant_write" ON public.redeem_codes;
DROP POLICY IF EXISTS "redeem_codes_owner_update" ON public.redeem_codes;
DROP POLICY IF EXISTS "redeem_codes_owner_delete" ON public.redeem_codes;

-- Explicitly grant ONLY SELECT and INSERT to authenticated (no direct UPDATE/DELETE)
GRANT SELECT, INSERT ON public.redeem_codes TO authenticated;
GRANT ALL ON public.redeem_codes TO service_role;

DROP POLICY IF EXISTS "redeem_codes_owner_select" ON public.redeem_codes;
CREATE POLICY "redeem_codes_owner_select" ON public.redeem_codes
  FOR SELECT TO authenticated
  USING (
    merchant_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

DROP POLICY IF EXISTS "redeem_codes_owner_insert" ON public.redeem_codes;
CREATE POLICY "redeem_codes_owner_insert" ON public.redeem_codes
  FOR INSERT TO authenticated
  WITH CHECK (
    status = 'active'
    AND order_id IS NULL
    AND redeemed_by_user_id IS NULL
    AND redeemed_at IS NULL
    AND (
      merchant_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
    )
  );

-- Controlled RPC to revoke/disable unused redeem codes
CREATE OR REPLACE FUNCTION public.revoke_redeem_code(p_code_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_merchant_id uuid;
  v_status text;
  v_caller uuid := auth.uid();
  v_is_admin boolean := false;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT role = 'ADMIN' INTO v_is_admin
  FROM public.profiles
  WHERE id = v_caller AND role IN ('MERCHANT', 'ADMIN');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  SELECT merchant_id, status INTO v_merchant_id, v_status
  FROM public.redeem_codes WHERE id = p_code_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CODE_NOT_FOUND';
  END IF;

  IF v_is_admin IS NOT TRUE AND v_merchant_id IS DISTINCT FROM v_caller THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  IF v_status = 'redeemed' THEN
    RAISE EXCEPTION 'CANNOT_REVOKE_REDEEMED_CODE';
  END IF;

  UPDATE public.redeem_codes SET status = 'disabled' WHERE id = p_code_id;
  RETURN true;
END; $$;

REVOKE ALL ON FUNCTION public.revoke_redeem_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_redeem_code(uuid) TO authenticated, service_role;

-- 6. Atomic Redeem Code RPC (Restricted to service_role, checks both sku.is_published and game.is_published)
CREATE OR REPLACE FUNCTION public.redeem_product_code(
  p_code text,
  p_sku_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_buyer_email text DEFAULT NULL,
  p_player_account text DEFAULT NULL,
  p_game_server text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_code_rec public.redeem_codes;
  v_sku_rec public.skus;
  v_game_rec public.games;
  v_clean_code text;
  v_order_id uuid;
  v_access_token uuid;
  v_fulfillment_status text;
  v_fulfillment_note text;
  v_fulfilled_at timestamptz;
  v_amount integer;
BEGIN
  IF p_code IS NULL OR length(btrim(p_code)) = 0 THEN
    RAISE EXCEPTION 'INVALID_REDEEM_CODE';
  END IF;

  v_clean_code := upper(btrim(p_code));

  -- Lock the code row
  SELECT * INTO v_code_rec FROM public.redeem_codes WHERE upper(code) = v_clean_code FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_REDEEM_CODE';
  END IF;

  IF v_code_rec.status = 'redeemed' THEN
    RAISE EXCEPTION 'CODE_ALREADY_USED';
  ELSIF v_code_rec.status != 'active' THEN
    RAISE EXCEPTION 'CODE_DISABLED';
  END IF;

  IF v_code_rec.expires_at IS NOT NULL AND v_code_rec.expires_at < now() THEN
    RAISE EXCEPTION 'CODE_EXPIRED';
  END IF;

  IF p_sku_id IS NOT NULL AND v_code_rec.sku_id != p_sku_id THEN
    RAISE EXCEPTION 'CODE_SKU_MISMATCH';
  END IF;

  -- Fetch SKU and Game; enforce publication status on both SKU and Game
  SELECT * INTO v_sku_rec FROM public.skus WHERE id = v_code_rec.sku_id;
  IF NOT FOUND OR NOT v_sku_rec.is_published THEN
    RAISE EXCEPTION 'PRODUCT_UNAVAILABLE';
  END IF;

  SELECT * INTO v_game_rec FROM public.games WHERE id = v_sku_rec.game_id;
  IF NOT FOUND OR NOT v_game_rec.is_published THEN
    RAISE EXCEPTION 'PRODUCT_UNAVAILABLE';
  END IF;

  IF v_sku_rec.requires_recipient_info AND (p_player_account IS NULL OR length(btrim(p_player_account)) = 0) THEN
    RAISE EXCEPTION 'RECIPIENT_INFO_REQUIRED';
  END IF;

  -- Determine delivery state and secret content
  IF v_code_rec.custom_delivery_content IS NOT NULL AND length(btrim(v_code_rec.custom_delivery_content)) > 0 THEN
    v_fulfillment_note := btrim(v_code_rec.custom_delivery_content);
  ELSE
    SELECT content INTO v_fulfillment_note
    FROM public.sku_fulfillment_secrets
    WHERE sku_id = v_sku_rec.id;
  END IF;

  IF v_sku_rec.delivery_mode = 'auto' THEN
    IF v_fulfillment_note IS NOT NULL AND length(btrim(v_fulfillment_note)) > 0 THEN
      v_fulfillment_status := 'fulfilled';
      v_fulfilled_at := now();
    ELSE
      -- Delivery secret not configured: fallback to pending for manual fulfillment
      v_fulfillment_status := 'pending';
      v_fulfilled_at := NULL;
      v_fulfillment_note := NULL;
    END IF;
  ELSE
    v_fulfillment_status := 'pending';
    v_fulfilled_at := NULL;
    v_fulfillment_note := NULL;
  END IF;

  v_amount := (v_sku_rec.prices->>'usd')::integer;
  IF v_amount IS NULL THEN v_amount := 0; END IF;

  v_access_token := gen_random_uuid();

  -- Insert completed order directly
  INSERT INTO public.orders (
    user_id,
    buyer_email,
    access_token,
    player_account,
    game_server,
    sku_id,
    merchant_id,
    amount,
    currency,
    payment_mode,
    status,
    redeem_code_id,
    fulfillment_status,
    fulfillment_note,
    fulfilled_at,
    fulfilled_by
  ) VALUES (
    p_user_id,
    btrim(p_buyer_email),
    v_access_token,
    btrim(p_player_account),
    btrim(p_game_server),
    v_sku_rec.id,
    v_game_rec.merchant_id,
    v_amount,
    'usd',
    'redeem',
    'completed',
    v_code_rec.id,
    v_fulfillment_status,
    v_fulfillment_note,
    v_fulfilled_at,
    CASE WHEN v_fulfillment_status = 'fulfilled' THEN v_game_rec.merchant_id ELSE NULL END
  ) RETURNING id INTO v_order_id;

  -- Mark redeem code as redeemed
  UPDATE public.redeem_codes SET
    status = 'redeemed',
    redeemed_by_user_id = p_user_id,
    redeemed_by_email = btrim(p_buyer_email),
    order_id = v_order_id,
    redeemed_at = now()
  WHERE id = v_code_rec.id;

  IF v_fulfillment_status = 'fulfilled' THEN
    INSERT INTO public.fulfillment_events(order_id, actor_id, status, note)
    VALUES(v_order_id, v_game_rec.merchant_id, 'fulfilled', v_fulfillment_note);
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'access_token', v_access_token,
    'sku_id', v_sku_rec.id,
    'fulfillment_status', v_fulfillment_status,
    'fulfillment_note', v_fulfillment_note
  );
END; $$;

-- Revoke from public/anon/authenticated. ONLY service_role can call this RPC.
REVOKE ALL ON FUNCTION public.redeem_product_code(text, uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_product_code(text, uuid, uuid, text, text, text) TO service_role;

-- 7. Upgrade apply_checkout_event to auto-fulfill 'auto' SKUs reading from sku_fulfillment_secrets
CREATE OR REPLACE FUNCTION public.apply_checkout_event(
 p_event_id text, p_order_id uuid, p_session_id text, p_status text, p_amount integer, p_currency text, p_livemode boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 target public.orders;
 v_sku public.skus;
 v_is_auto boolean := false;
 v_auto_content text;
BEGIN
 SELECT * INTO target FROM public.orders WHERE id = p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF target.stripe_checkout_session_id IS DISTINCT FROM p_session_id THEN RAISE EXCEPTION 'Session mismatch'; END IF;
 IF p_amount IS DISTINCT FROM target.amount OR p_currency IS DISTINCT FROM target.currency THEN RAISE EXCEPTION 'Payment amount or currency mismatch'; END IF;
 IF target.payment_mode IS DISTINCT FROM (CASE WHEN p_livemode THEN 'live' ELSE 'test' END) THEN RAISE EXCEPTION 'Payment mode mismatch'; END IF;
 IF p_status NOT IN ('completed', 'failed') THEN RAISE EXCEPTION 'Unsupported status'; END IF;
 IF EXISTS(SELECT 1 FROM public.payment_events WHERE event_id = p_event_id) THEN RETURN; END IF;

 IF target.status = 'pending' THEN
   IF p_status = 'completed' THEN
     SELECT * INTO v_sku FROM public.skus WHERE id = target.sku_id;
     IF FOUND AND v_sku.delivery_mode = 'auto' THEN
       SELECT content INTO v_auto_content
       FROM public.sku_fulfillment_secrets
       WHERE sku_id = target.sku_id;

       IF v_auto_content IS NOT NULL AND length(btrim(v_auto_content)) > 0 THEN
         v_is_auto := true;
       END IF;
     END IF;

     UPDATE public.orders SET
       status = p_status,
       fulfillment_status = CASE WHEN v_is_auto THEN 'fulfilled' ELSE fulfillment_status END,
       fulfilled_at = CASE WHEN v_is_auto THEN now() ELSE fulfilled_at END,
       fulfilled_by = CASE WHEN v_is_auto THEN target.merchant_id ELSE fulfilled_by END,
       fulfillment_note = CASE WHEN v_is_auto THEN v_auto_content ELSE fulfillment_note END
     WHERE id = p_order_id;

     IF v_is_auto THEN
       INSERT INTO public.fulfillment_events(order_id, actor_id, status, note)
       VALUES(p_order_id, target.merchant_id, 'fulfilled', v_auto_content);
     END IF;
   ELSE
     UPDATE public.orders SET status = p_status WHERE id = p_order_id;
   END IF;
 END IF;

 INSERT INTO public.payment_events(event_id, order_id) VALUES(p_event_id, p_order_id);
END; $$;

REVOKE ALL ON FUNCTION public.apply_checkout_event(text, uuid, text, text, integer, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_checkout_event(text, uuid, text, text, integer, text, boolean) TO service_role;

-- 8. Prevent self-appointment of MERCHANT or ADMIN role in registration
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Strict single-owner/SaaS storefront policy:
  -- All public registrations produce 'USER'. Self-appointing 'MERCHANT' or 'ADMIN' via signup metadata is prohibited.
  INSERT INTO public.profiles(id, role, merchant_name)
  VALUES(NEW.id, 'USER', NULL)
  ON CONFLICT(id) DO NOTHING;
  RETURN NEW;
END; $$;

COMMIT;
