BEGIN;

-- Requires the SaaS storefront migration. Safe to apply to databases with its earlier drafts.
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

REVOKE ALL ON public.redeem_codes FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "redeem_codes_owner_write" ON public.redeem_codes;
DROP POLICY IF EXISTS "redeem_codes_owner_all" ON public.redeem_codes;
DROP POLICY IF EXISTS "redeem_codes_merchant_all" ON public.redeem_codes;
DROP POLICY IF EXISTS "redeem_codes_merchant_write" ON public.redeem_codes;
DROP POLICY IF EXISTS "redeem_codes_owner_update" ON public.redeem_codes;
DROP POLICY IF EXISTS "redeem_codes_owner_delete" ON public.redeem_codes;
GRANT SELECT, INSERT ON public.redeem_codes TO authenticated;
GRANT ALL ON public.redeem_codes TO service_role;

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

COMMIT;
