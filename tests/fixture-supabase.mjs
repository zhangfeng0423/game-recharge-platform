// Isolated HTTP fixture for browser tests. No external credentials or real payments.
import http from "node:http";

const ids = {
  buyer: "10000000-0000-4000-8000-000000000001",
  merchant: "20000000-0000-4000-8000-000000000001",
  game: "30000000-0000-4000-8000-000000000001",
  sku: "40000000-0000-4000-8000-000000000001",
};
const time = "2026-10-01T00:00:00Z";
const sku = {
  id: ids.sku,
  game_id: ids.game,
  name: { en: "Crystal Pack", zh: "水晶礼包" },
  description: { en: "100 test crystals", zh: "100 测试水晶" },
  prices: { usd: 1099 },
  image_url: null,
  delivery_mode: "manual",
  is_published: true,
  requires_recipient_info: true,
  created_at: time,
  updated_at: time,
};
const game = {
  id: ids.game,
  merchant_id: ids.merchant,
  name: { en: "Test Adventure", zh: "测试冒险" },
  description: { en: "A test catalogue item", zh: "测试目录商品" },
  banner_url: null,
  is_published: true,
  skus: [sku],
  created_at: time,
  updated_at: time,
};
const users = [
  { id: ids.buyer, email: "buyer@example.test", role: "USER" },
  { id: ids.merchant, email: "merchant@example.test", role: "MERCHANT" },
];
const orders = [
  {
    id: "50000000-0000-4000-8000-000000000001",
    user_id: ids.buyer,
    merchant_id: ids.merchant,
    sku_id: ids.sku,
    amount: 1099,
    currency: "usd",
    status: "pending",
    payment_mode: "test",
    stripe_checkout_session_id: "cs_fixture_pending",
    created_at: time,
    updated_at: time,
    sku,
  },
  {
    id: "50000000-0000-4000-8000-000000000002",
    user_id: ids.buyer,
    merchant_id: ids.merchant,
    sku_id: ids.sku,
    amount: 1099,
    currency: "usd",
    status: "completed",
    payment_mode: "redeem",
    access_token: "70000000-0000-4000-8000-000000000002",
    fulfillment_status: "fulfilled",
    fulfillment_note: "FIXTURE_SECRET_DOWNLOAD_KEY",
    created_at: time,
    updated_at: time,
    sku,
  },
];
const managedCodes = [
  {
    id: "60000000-0000-4000-8000-000000000001",
    sku_id: ids.sku,
    merchant_id: ids.merchant,
    code: "NX-MANAGED-FIXTURE",
    status: "active",
    batch_note: "browser verification",
    order_id: null,
    created_at: time,
  },
];
function token(user) {
  return [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: user.id,
        exp: Math.floor(Date.now() / 1000) + 3600,
        role: "authenticated",
        aud: "authenticated",
      }),
    ).toString("base64url"),
    "fixture",
  ].join(".");
}
function userFrom(req) {
  try {
    const jwt = req.headers.authorization?.split(" ")[1];
    const payload = JSON.parse(
      Buffer.from(jwt.split(".")[1], "base64url").toString(),
    );
    return users.find((u) => u.id === payload.sub);
  } catch {
    return undefined;
  }
}
http
  .createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const url = new URL(req.url, "http://127.0.0.1:54329");
    let body;
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      body = {};
    }
    const json = (data, status = 200) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Content-Range": `0-0/1`,
      });
      res.end(JSON.stringify(data));
    };
    if (url.pathname === "/health") return json({ ok: true });
    if (url.pathname === "/rest/v1/rpc/redeem_product_code") {
      if (body.p_code === "NX-TEST-REDEEM-OK") {
        return json({
          order_id: "50000000-0000-4000-8000-000000000002",
          access_token: "70000000-0000-4000-8000-000000000002",
          sku_id: ids.sku,
          fulfillment_status: "fulfilled",
          fulfillment_note: "FIXTURE_SECRET_DOWNLOAD_KEY",
        });
      }
      return json({ message: "INVALID_REDEEM_CODE" }, 400);
    }
    if (url.pathname === "/rest/v1/rpc/revoke_redeem_code") {
      if (userFrom(req)?.role !== "MERCHANT")
        return json({ message: "PERMISSION_DENIED" }, 403);
      const code = managedCodes.find((c) => c.id === body.p_code_id);
      if (!code || code.status !== "active")
        return json({ message: "CODE_NOT_ACTIVE" }, 400);
      code.status = "disabled";
      return json(true);
    }
    if (url.pathname === "/auth/v1/recover") return json({});
    if (url.pathname === "/auth/v1/token") {
      const user = users.find((u) => u.email === body.email);
      if (!user || body.password !== "test-password-123")
        return json(
          { error_code: "invalid_credentials", msg: "Invalid credentials" },
          400,
        );
      return json({
        access_token: token(user),
        refresh_token: "fixture_refresh",
        expires_in: 3600,
        token_type: "bearer",
        user: {
          id: user.id,
          email: user.email,
          aud: "authenticated",
          created_at: time,
        },
      });
    }
    if (url.pathname === "/auth/v1/user") {
      const user = userFrom(req);
      return user
        ? json({
            id: user.id,
            email: user.email,
            aud: "authenticated",
            created_at: time,
          })
        : json({ msg: "Invalid token" }, 401);
    }
    if (url.pathname === "/auth/v1/logout") {
      res.writeHead(204);
      return res.end();
    }
    if (url.pathname.startsWith("/rest/v1/")) {
      const table = url.pathname.split("/").pop();
      let rows =
        table === "games"
          ? [game]
          : table === "skus"
            ? [
                {
                  ...sku,
                  games: {
                    id: game.id,
                    merchant_id: game.merchant_id,
                    is_published: true,
                  },
                },
              ]
            : table === "profiles"
              ? users.map((u) => ({
                  id: u.id,
                  role: u.role,
                  merchant_name: u.role === "MERCHANT" ? "Test Shop" : null,
                }))
              : table === "orders"
                ? orders
                : table === "redeem_codes"
                  ? managedCodes
                  : [];
      for (const [key, value] of url.searchParams) {
        if (!value.startsWith("eq.")) continue;
        if (key === "skus.is_published") {
          rows = rows.map((x) => ({
            ...x,
            skus: (x.skus || []).filter(
              (s) => String(s.is_published) === value.slice(3),
            ),
          }));
        } else {
          rows = rows.filter((x) => String(x[key]) === value.slice(3));
        }
      }
      if (req.method === "HEAD") {
        res.writeHead(200, { "Content-Range": `0-0/${rows.length}` });
        return res.end();
      }
      if (req.method !== "GET")
        return json({ message: "Fixture is read only" }, 405);
      return json(
        req.headers.accept?.includes("vnd.pgrst.object") ? rows[0] : rows,
      );
    }
    return json({ message: "Not found" }, 404);
  })
  .listen(54329, "127.0.0.1");
