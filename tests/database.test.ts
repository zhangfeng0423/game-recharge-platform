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
  await db.query(
    `INSERT INTO auth.users(id,raw_user_meta_data) VALUES($1,'{}'),($2,'{"role":"MERCHANT","merchant_name":"Shop A"}'),($3,'{"role":"MERCHANT","merchant_name":"Shop B"}')`,
    [buyer, merchant, other],
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
    `INSERT INTO public.orders(id,user_id,sku_id,merchant_id,amount,stripe_checkout_session_id) VALUES($1,$2,$3,$4,100,'cs_paid')`,
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
  it("creates a merchant profile transactionally", async () => {
    expect(
      (
        await db.query(`SELECT role,merchant_name FROM profiles WHERE id=$1`, [
          merchant,
        ])
      ).rows[0],
    ).toEqual({ role: "MERCHANT", merchant_name: "Shop A" });
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
        `SELECT apply_checkout_event('evt_user',$1,'cs_paid','completed',100,'usd')`,
        [order],
      ),
    ).rejects.toThrow(/permission denied/);
  });
  it("rejects mismatched sessions and amounts atomically", async () => {
    await expect(
      db.query(
        `SELECT apply_checkout_event('evt_bad',$1,'cs_other','completed',100,'usd')`,
        [order],
      ),
    ).rejects.toThrow(/Session mismatch/);
    await expect(
      db.query(
        `SELECT apply_checkout_event('evt_bad',$1,'cs_paid','completed',0,'usd')`,
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
      `SELECT apply_checkout_event('evt_good',$1,'cs_paid','completed',100,'usd')`,
      [order],
    );
    await db.query(
      `SELECT apply_checkout_event('evt_good',$1,'cs_paid','completed',100,'usd')`,
      [order],
    );
    await db.query(
      `SELECT apply_checkout_event('evt_late',$1,'cs_paid','failed',100,'usd')`,
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
