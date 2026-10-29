import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

let db: PGlite;
const buyer = "10000000-0000-0000-0000-000000000001",
  merchant = "20000000-0000-0000-0000-000000000001",
  other = "20000000-0000-0000-0000-000000000002";
const game = "30000000-0000-0000-0000-000000000001",
  sku = "40000000-0000-0000-0000-000000000001",
  order = "50000000-0000-0000-0000-000000000001";
beforeAll(async () => {
  db = new PGlite({ extensions: { uuid_ossp } });
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb DEFAULT '{}');
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;`);
  await db.exec(
    readFileSync("supabase/migrations/20250109_001_initial_schema.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/9999_merchant_analytics_rpc.sql", "utf8"),
  );
  await db.exec(
    "GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,authenticated,service_role;",
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261028160000_launch_hardening.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261028170000_manual_fulfillment.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync("supabase/migrations/20261028180000_payment_mode.sql", "utf8"),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261029000000_saas_storefront_and_redeem.sql",
      "utf8",
    ),
  );
  await db.query(
    `INSERT INTO auth.users(id,raw_user_meta_data) VALUES($1,'{}'),($2,'{}'),($3,'{}')`,
    [buyer, merchant, other],
  );
  await db.query(
    `UPDATE public.profiles SET role='MERCHANT', merchant_name='Shop A' WHERE id=$1`,
    [merchant],
  );
  await db.query(
    `UPDATE public.profiles SET role='MERCHANT', merchant_name='Shop B' WHERE id=$1`,
    [other],
  );
  await db.query(
    `INSERT INTO public.games(id,name,merchant_id) VALUES($1,'{"en":"Game","zh":"游戏"}',$2)`,
    [game, merchant],
  );
  await db.query(
    `INSERT INTO public.skus(id,name,prices,game_id) VALUES($1,'{"en":"Pack","zh":"礼包"}','{"usd":100}',$2)`,
    [sku, game],
  );
  await db.query(
    `INSERT INTO public.orders(id,user_id,sku_id,merchant_id,amount,stripe_checkout_session_id,payment_mode) VALUES($1,$2,$3,$4,100,'cs_paid','test')`,
    [order, buyer, sku, merchant],
  );
});
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec("RESET ROLE");
  await db.query(`SELECT set_config('request.jwt.claim.sub','',false)`);
});
async function asUser(id: string) {
  await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [id]);
  await db.exec("SET ROLE authenticated");
}
describe("actual PostgreSQL migrations and RLS", () => {
  it("prevents signup metadata from granting ADMIN", async () => {
    const id = "10000000-0000-0000-0000-000000000009";
    await db.query(
      `INSERT INTO auth.users(id,raw_user_meta_data) VALUES($1,'{"role":"ADMIN"}')`,
      [id],
    );
    expect(
      (await db.query(`SELECT role FROM profiles WHERE id=$1`, [id])).rows[0],
    ).toMatchObject({ role: "USER" });
  });
  it("prevents signup metadata from granting MERCHANT in single-storefront mode", async () => {
    const id = "10000000-0000-0000-0000-000000000008";
    await db.query(
      `INSERT INTO auth.users(id,raw_user_meta_data) VALUES($1,'{"role":"MERCHANT","merchant_name":"Hacker Shop"}')`,
      [id],
    );
    expect(
      (
        await db.query(`SELECT role,merchant_name FROM profiles WHERE id=$1`, [
          id,
        ])
      ).rows[0],
    ).toEqual({ role: "USER", merchant_name: null });
  });
  it("does not allow a user to promote their own profile", async () => {
    await asUser(buyer);
    await expect(
      db.query(`UPDATE profiles SET role='ADMIN' WHERE id=$1`, [buyer]),
    ).rejects.toThrow();
  });
  it("prevents direct forged paid orders", async () => {
    await asUser(buyer);
    await expect(
      db.query(
        `INSERT INTO orders(user_id,sku_id,merchant_id,amount,status) VALUES($1,$2,$3,1,'completed')`,
        [buyer, sku, merchant],
      ),
    ).rejects.toThrow();
  });
  it("prevents direct payment-state updates", async () => {
    await asUser(buyer);
    await expect(
      db.query(`UPDATE orders SET status='completed' WHERE id=$1`, [order]),
    ).rejects.toThrow();
  });
  it("allows a buyer to see their own order", async () => {
    await asUser(buyer);
    expect((await db.query(`SELECT id FROM orders`)).rows).toHaveLength(1);
  });
  it("isolates another merchant's orders", async () => {
    await asUser(other);
    expect((await db.query(`SELECT id FROM orders`)).rows).toHaveLength(0);
  });
  it("prevents another merchant from editing a game", async () => {
    await asUser(other);
    expect(
      (
        await db.query(
          `UPDATE games SET name='{"en":"bad","zh":"bad"}' WHERE id=$1 RETURNING id`,
          [game],
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("revokes unsafe analytics RPC access", async () => {
    await asUser(other);
    await expect(
      db.query(`SELECT * FROM get_merchant_analytics($1)`, [merchant]),
    ).rejects.toThrow(/permission denied/);
  });
  it("prevents a buyer from invoking the payment RPC", async () => {
    await asUser(buyer);
    await expect(
      db.query(
        `SELECT apply_checkout_event('evt_user',$1,'cs_paid','completed',100,'usd',false)`,
        [order],
      ),
    ).rejects.toThrow(/permission denied/);
  });
  it("rejects mismatched sessions and amounts atomically", async () => {
    await expect(
      db.query(
        `SELECT apply_checkout_event('evt_bad',$1,'cs_other','completed',100,'usd',false)`,
        [order],
      ),
    ).rejects.toThrow(/Session mismatch/);
    await expect(
      db.query(
        `SELECT apply_checkout_event('evt_bad',$1,'cs_paid','completed',0,'usd',false)`,
        [order],
      ),
    ).rejects.toThrow(/mismatch/);
    expect(
      (await db.query(`SELECT status FROM orders WHERE id=$1`, [order]))
        .rows[0],
    ).toMatchObject({ status: "pending" });
  });
  it("handles duplicate and delayed events without regressing paid orders", async () => {
    await db.query(
      `SELECT apply_checkout_event('evt_good',$1,'cs_paid','completed',100,'usd',false)`,
      [order],
    );
    await db.query(
      `SELECT apply_checkout_event('evt_good',$1,'cs_paid','completed',100,'usd',false)`,
      [order],
    );
    await db.query(
      `SELECT apply_checkout_event('evt_late',$1,'cs_paid','failed',100,'usd',false)`,
      [order],
    );
    expect(
      (await db.query(`SELECT status FROM orders WHERE id=$1`, [order]))
        .rows[0],
    ).toMatchObject({ status: "completed" });
    expect(
      (await db.query(`SELECT * FROM payment_events WHERE event_id='evt_good'`))
        .rows,
    ).toHaveLength(1);
  });
  it("retains financial history when a product is deleted", async () => {
    await expect(
      db.query(`DELETE FROM skus WHERE id=$1`, [sku]),
    ).rejects.toThrow(/foreign key/);
    expect((await db.query(`SELECT id FROM orders`)).rows).toHaveLength(1);
  });
});

describe("manual fulfillment authorization", () => {
  it("prevents buyers from marking their own delivery", async () => {
    await asUser(buyer);
    await expect(
      db.query("SELECT set_order_fulfillment($1,'fulfilled','sent')", [order]),
    ).rejects.toThrow(/Merchant access/);
  });
  it("prevents another merchant from delivering this order", async () => {
    await asUser(other);
    await expect(
      db.query("SELECT set_order_fulfillment($1,'fulfilled','sent')", [order]),
    ).rejects.toThrow(/Order not found/);
  });
  it("records owner delivery and ignores duplicate confirmations", async () => {
    await asUser(merchant);
    await db.query(
      "SELECT set_order_fulfillment($1,'fulfilled','reference-123')",
      [order],
    );
    await db.query(
      "SELECT set_order_fulfillment($1,'fulfilled','reference-123')",
      [order],
    );
    await db.exec("RESET ROLE");
    expect(
      (
        await db.query(
          "SELECT fulfillment_status,fulfilled_by,fulfillment_note FROM orders WHERE id=$1",
          [order],
        )
      ).rows[0],
    ).toMatchObject({
      fulfillment_status: "fulfilled",
      fulfilled_by: merchant,
      fulfillment_note: "reference-123",
    });
    expect(
      (await db.query("SELECT * FROM fulfillment_events")).rows,
    ).toHaveLength(1);
  });
  it("does not let late operator updates regress delivery", async () => {
    await asUser(merchant);
    await expect(
      db.query("SELECT set_order_fulfillment($1,'attention','late')", [order]),
    ).rejects.toThrow(/cannot regress/);
  });
});

it("rejects live-mode events for a test order", async () => {
  await expect(
    db.query(
      "SELECT apply_checkout_event('evt_live_wrong',$1,'cs_paid','completed',100,'usd',true)",
      [order],
    ),
  ).rejects.toThrow(/mode mismatch/);
});

describe("SaaS template redeem codes and auto-fulfillment", () => {
  const autoSku = "40000000-0000-0000-0000-000000000002";
  const redeemCode = "NX-TEST-CODE-1234";

  beforeAll(async () => {
    await db.exec("RESET ROLE");
    await db.query(
      `INSERT INTO public.skus(id,name,prices,game_id,delivery_mode)
       VALUES($1,'{"en":"Digital SaaS","zh":"数字产品"}','{"usd":999}',$2,'auto')`,
      [autoSku, game],
    );
    await db.query(
      `INSERT INTO public.sku_fulfillment_secrets(sku_id,content)
       VALUES($1,'https://download.example/asset.zip')`,
      [autoSku],
    );
    await db.query(
      `INSERT INTO public.redeem_codes(code,sku_id,merchant_id)
       VALUES($1,$2,$3)`,
      [redeemCode, autoSku, merchant],
    );
  });

  it("redeems valid code, marks fulfilled immediately, and generates completed order", async () => {
    const res = await db.query(
      "SELECT redeem_product_code($1,$2,$3,$4,$5,$6) AS result",
      [redeemCode, autoSku, buyer, "buyer@example.com", null, null],
    );
    const result = (res.rows[0] as { result: any }).result;
    expect(result.fulfillment_status).toBe("fulfilled");
    expect(result.fulfillment_note).toBe("https://download.example/asset.zip");
    expect(result.access_token).toBeDefined();

    // Verify order in database
    const orderRow = (
      await db.query("SELECT * FROM public.orders WHERE id=$1", [
        result.order_id,
      ])
    ).rows[0];
    expect(orderRow).toMatchObject({
      status: "completed",
      payment_mode: "redeem",
      fulfillment_status: "fulfilled",
      fulfillment_note: "https://download.example/asset.zip",
    });

    // Verify code marked redeemed
    const codeRow = (
      await db.query(
        "SELECT status,order_id FROM public.redeem_codes WHERE code=$1",
        [redeemCode],
      )
    ).rows[0];
    expect(codeRow.status).toBe("redeemed");
    expect(codeRow.order_id).toBe(result.order_id);
  });

  it("prevents double-spending of the same redeem code", async () => {
    await expect(
      db.query("SELECT redeem_product_code($1,$2,$3,$4,$5,$6)", [
        redeemCode,
        autoSku,
        buyer,
        null,
        null,
        null,
      ]),
    ).rejects.toThrow(/CODE_ALREADY_USED/);
  });

  it("rejects invalid redeem codes", async () => {
    await expect(
      db.query("SELECT redeem_product_code('NONEXISTENT-CODE',$1)", [autoSku]),
    ).rejects.toThrow(/INVALID_REDEEM_CODE/);
  });

  it("auto-fulfills orders with auto delivery mode upon Stripe payment event", async () => {
    const autoOrder = "50000000-0000-0000-0000-000000000099";
    await db.query(
      `INSERT INTO public.orders(id,user_id,sku_id,merchant_id,amount,currency,stripe_checkout_session_id,payment_mode,status)
       VALUES($1,$2,$3,$4,999,'usd','cs_test_auto','test','pending')`,
      [autoOrder, buyer, autoSku, merchant],
    );

    await db.query(
      "SELECT apply_checkout_event('evt_auto_pay',$1,'cs_test_auto','completed',999,'usd',false)",
      [autoOrder],
    );

    const orderRow = (
      await db.query("SELECT * FROM public.orders WHERE id=$1", [autoOrder])
    ).rows[0];
    expect(orderRow.status).toBe("completed");
    expect(orderRow.fulfillment_status).toBe("fulfilled");
    expect(orderRow.fulfillment_note).toBe(
      "https://download.example/asset.zip",
    );
    expect(orderRow.fulfilled_at).toBeDefined();
  });

  it("prevents anonymous and authenticated users from calling redeem_product_code directly", async () => {
    await db.exec("SET ROLE anon");
    await expect(
      db.query("SELECT redeem_product_code('NX-TEST-CODE-1234')"),
    ).rejects.toThrow(/permission denied/);

    await asUser(buyer);
    await expect(
      db.query("SELECT redeem_product_code('NX-TEST-CODE-1234')"),
    ).rejects.toThrow(/permission denied/);
    await db.exec("RESET ROLE");
  });

  it("prevents anonymous users from selecting redeem_codes table directly", async () => {
    await db.exec("SET ROLE anon");
    await expect(db.query("SELECT * FROM public.redeem_codes")).rejects.toThrow(
      /permission denied/,
    );
    await db.exec("RESET ROLE");
  });

  it("prevents anonymous users and buyers from reading sku_fulfillment_secrets", async () => {
    await db.exec("SET ROLE anon");
    await expect(
      db.query("SELECT * FROM public.sku_fulfillment_secrets"),
    ).rejects.toThrow(/permission denied/);

    await asUser(buyer);
    const buyerRows = await db.query(
      "SELECT * FROM public.sku_fulfillment_secrets",
    );
    expect(buyerRows.rows).toHaveLength(0);
    await db.exec("RESET ROLE");
  });

  it("verifies public skus table contains no secret auto_delivery_content column", async () => {
    await db.exec("SET ROLE anon");
    const res = await db.query("SELECT * FROM public.skus WHERE id=$1", [
      autoSku,
    ]);
    expect(res.rows[0]).toBeDefined();
    expect((res.rows[0] as any).auto_delivery_content).toBeUndefined();
    await db.exec("RESET ROLE");
  });

  it("prevents cross-merchant redeem code creation", async () => {
    await expect(
      db.query(
        `INSERT INTO public.redeem_codes(code,sku_id,merchant_id)
         VALUES('NX-CROSS-MERCHANT-1',$1,$2)`,
        [autoSku, other],
      ),
    ).rejects.toThrow(/MERCHANT_SKU_MISMATCH/);
  });

  it("ensures replaying the migration does not overwrite configured auto SKU modes", async () => {
    // 1. Mark autoSku explicitly as auto
    await db.query(
      "UPDATE public.skus SET delivery_mode = 'auto' WHERE id = $1",
      [autoSku],
    );

    // 2. Re-run migration SQL
    await db.exec(
      readFileSync(
        "supabase/migrations/20261029000000_saas_storefront_and_redeem.sql",
        "utf8",
      ),
    );

    // 3. Verify it remained auto
    const res = await db.query(
      "SELECT delivery_mode FROM public.skus WHERE id = $1",
      [autoSku],
    );
    expect(res.rows[0].delivery_mode).toBe("auto");
  });

  it("ensures authenticated users have zero UPDATE permission on redeem_codes", async () => {
    await asUser(merchant);
    await expect(
      db.query(
        "UPDATE public.redeem_codes SET status = 'active' WHERE code = $1",
        [redeemCode],
      ),
    ).rejects.toThrow(/permission denied/);
    await db.exec("RESET ROLE");
  });

  it("rejects redemption of unpublished SKUs", async () => {
    const unpubSku = "40000000-0000-0000-0000-000000000098";
    const unpubCode = "NX-UNPUB-CODE-9999";
    await db.query(
      `INSERT INTO public.skus(id,name,prices,game_id,delivery_mode,is_published)
       VALUES($1,'{"en":"Unpublished","zh":"未发布"}'::jsonb,'{"usd":500}'::jsonb,$2,'auto',false)`,
      [unpubSku, game],
    );
    await db.query(
      `INSERT INTO public.sku_fulfillment_secrets(sku_id,content)
       VALUES($1,'UNPUB_SECRET')`,
      [unpubSku],
    );
    await db.query(
      `INSERT INTO public.redeem_codes(code,sku_id,merchant_id)
       VALUES($1,$2,$3)`,
      [unpubCode, unpubSku, merchant],
    );

    await expect(
      db.query("SELECT redeem_product_code($1,$2,$3)", [
        unpubCode,
        unpubSku,
        buyer,
      ]),
    ).rejects.toThrow(/PRODUCT_UNAVAILABLE/);
  });

  it("atomically saves SKU and secret via save_sku_with_secret and rejects auto without secret", async () => {
    await asUser(merchant);
    const newSkuId = "40000000-0000-0000-0000-000000000097";
    await db.query(
      `SELECT save_sku_with_secret(
        $1, $2, '{"en":"Atomic SKU","zh":"原子商品"}'::jsonb, '{"en":"Desc","zh":"描述"}'::jsonb, '{"usd":1299}'::jsonb,
        null, 'auto', null, false, '{"en":"Info","zh":"信息"}'::jsonb, true, 'ATOMIC_SECRET_CONTENT'
      )`,
      [newSkuId, game],
    );

    // Verify both were committed
    const skuRes = await db.query(
      "SELECT delivery_mode FROM public.skus WHERE id = $1",
      [newSkuId],
    );
    expect(skuRes.rows[0].delivery_mode).toBe("auto");

    const secretRes = await db.query(
      "SELECT content FROM public.sku_fulfillment_secrets WHERE sku_id = $1",
      [newSkuId],
    );
    expect(secretRes.rows[0].content).toBe("ATOMIC_SECRET_CONTENT");

    // Negative test: auto delivery mode without secret must fail atomically
    await expect(
      db.query(
        `SELECT save_sku_with_secret(
          null, $1, '{"en":"Bad SKU","zh":"错误商品"}'::jsonb, '{"en":"Desc","zh":"描述"}'::jsonb, '{"usd":1299}'::jsonb,
          null, 'auto', null, false, '{"en":"Info","zh":"信息"}'::jsonb, true, ''
        )`,
        [game],
      ),
    ).rejects.toThrow(/DELIVERY_CONTENT_REQUIRED/);

    await db.exec("RESET ROLE");
  });
});

// Exercise RPCs directly with database roles, without the Server Action's checks.
describe("storefront access boundaries and upgrade", () => {
  const target = "40000000-0000-0000-0000-000000000090";
  const noProfile = "10000000-0000-0000-0000-000000000090";
  const codeId = "60000000-0000-0000-0000-000000000090";
  const upgrade = () =>
    db.exec(
      readFileSync(
        "supabase/migrations/20261029160000_storefront_access_boundaries.sql",
        "utf8",
      ),
    );
  const save = () =>
    db.query(
      `SELECT save_sku_with_secret($1,$2,'{"en":"Changed","zh":"修改"}','{"en":"Desc","zh":"描述"}','{"usd":999}',NULL,'auto',NULL,false,NULL,false,'REPLACED_SECRET')`,
      [target, game],
    );
  beforeAll(async () => {
    await db.exec("RESET ROLE");
    await upgrade();
    await db.query("INSERT INTO auth.users(id) VALUES($1)", [noProfile]);
    await db.query("DELETE FROM public.profiles WHERE id=$1", [noProfile]);
    await db.query(
      `INSERT INTO public.skus(id,game_id,name,prices,delivery_mode,is_published) VALUES($1,$2,'{"en":"Hidden","zh":"隐藏"}','{"usd":100}','auto',false)`,
      [target, game],
    );
    await db.query(
      "INSERT INTO public.sku_fulfillment_secrets(sku_id,content) VALUES($1,'ORIGINAL_SECRET')",
      [target],
    );
    await db.query(
      "INSERT INTO public.redeem_codes(id,code,sku_id,merchant_id) VALUES($1,'NX-BOUNDARY-TEST',$2,$3)",
      [codeId, target, merchant],
    );
  });
  it("rejects saving another merchant's SKU when the auth user has no profile", async () => {
    await asUser(noProfile);
    await expect(save()).rejects.toThrow(/PERMISSION_DENIED/);
    await db.exec("RESET ROLE");
    const secret = await db.query(
      "SELECT content FROM public.sku_fulfillment_secrets WHERE sku_id=$1",
      [target],
    );
    expect(secret.rows[0].content).toBe("ORIGINAL_SECRET");
  });
  it("rejects revoking another merchant's code when the auth user has no profile", async () => {
    await asUser(noProfile);
    await expect(
      db.query("SELECT revoke_redeem_code($1)", [codeId]),
    ).rejects.toThrow(/PERMISSION_DENIED/);
    await db.exec("RESET ROLE");
    expect(
      (
        await db.query("SELECT status FROM public.redeem_codes WHERE id=$1", [
          codeId,
        ])
      ).rows[0].status,
    ).toBe("active");
  });
  it("rejects buyers and other merchants from directly saving another owner's SKU", async () => {
    for (const caller of [buyer, other]) {
      await asUser(caller);
      await expect(save()).rejects.toThrow(/PERMISSION_DENIED/);
    }
  });
  it("does not expose unpublished SKUs to anonymous visitors or buyers", async () => {
    await db.exec("SET ROLE anon");
    expect(
      (await db.query("SELECT id FROM public.skus WHERE id=$1", [target])).rows,
    ).toHaveLength(0);
    await asUser(buyer);
    expect(
      (await db.query("SELECT id FROM public.skus WHERE id=$1", [target])).rows,
    ).toHaveLength(0);
    await asUser(merchant);
    expect(
      (await db.query("SELECT id FROM public.skus WHERE id=$1", [target])).rows,
    ).toHaveLength(1);
  });
  it("preserves owner management and permits admin management of another owner's product", async () => {
    await asUser(merchant);
    await expect(save()).resolves.toBeDefined();
    await db.exec("RESET ROLE");
    const admin = "10000000-0000-0000-0000-000000000091";
    await db.query("INSERT INTO auth.users(id) VALUES($1)", [admin]);
    await db.query("UPDATE public.profiles SET role='ADMIN' WHERE id=$1", [
      admin,
    ]);
    await asUser(admin);
    await expect(save()).resolves.toBeDefined();
  });
  it("cleans legacy permissive policies and privileges when the upgrade is replayed", async () => {
    await db.exec(`CREATE POLICY "Everyone can view SKUs" ON public.skus FOR SELECT USING(true);
      GRANT UPDATE,DELETE ON public.redeem_codes TO authenticated;
      CREATE POLICY "redeem_codes_owner_write" ON public.redeem_codes FOR ALL TO authenticated USING(merchant_id=auth.uid()) WITH CHECK(merchant_id=auth.uid());`);
    await upgrade();
    await upgrade();
    await db.exec("SET ROLE anon");
    expect(
      (await db.query("SELECT id FROM public.skus WHERE id=$1", [target])).rows,
    ).toHaveLength(0);
    await asUser(merchant);
    await expect(
      db.query("UPDATE public.redeem_codes SET status='active' WHERE id=$1", [
        codeId,
      ]),
    ).rejects.toThrow(/permission denied/);
  });
});
