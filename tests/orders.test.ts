import { beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  user: vi.fn(),
  db: vi.fn(),
  admin: vi.fn(),
}));
vi.mock("@/actions/auth.actions", () => ({ getCurrentUser: m.user }));
vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServerClientWithCookies: m.db,
  createSupabaseAdminClient: m.admin,
}));

import {
  getOrderByIdServer,
  getOrderBySessionAndTokenServer,
  getOrderBySessionIdServer,
  getOrderReceiptServer,
} from "@/actions/order.actions";

beforeEach(() => vi.resetAllMocks());

it("does not query orders for anonymous visitors", async () => {
  m.user.mockResolvedValue(null);
  expect(await getOrderByIdServer("id")).toBeNull();
  expect(m.db).not.toHaveBeenCalled();
});

it("queries the real session column and scopes to the verified user", async () => {
  const eq = vi.fn();
  const chain = {
    select: vi.fn(),
    eq,
    maybeSingle: vi
      .fn()
      .mockResolvedValue({ data: { id: "own" }, error: null }),
  };
  chain.select.mockReturnValue(chain);
  eq.mockReturnValue(chain);
  m.user.mockResolvedValue({ id: "buyer" });
  m.db.mockResolvedValue({ from: () => chain });
  expect(await getOrderBySessionIdServer("cs_test_1")).toEqual({ id: "own" });
  expect(eq).toHaveBeenCalledWith("stripe_checkout_session_id", "cs_test_1");
  expect(eq).toHaveBeenCalledWith("user_id", "buyer");
});

it("allows guest receipt retrieval only with matching access_token and session_id", async () => {
  const validToken = "70000000-0000-4000-8000-000000000001";
  const eq = vi.fn();
  const chain = {
    select: vi.fn(),
    eq,
    maybeSingle: vi.fn().mockResolvedValue({
      data: { id: "order-guest", access_token: validToken },
      error: null,
    }),
  };
  chain.select.mockReturnValue(chain);
  eq.mockReturnValue(chain);
  m.admin.mockReturnValue({ from: () => chain });

  // 1. Guest without token -> null
  m.user.mockResolvedValue(null);
  expect(
    await getOrderBySessionAndTokenServer("cs_guest_1", undefined),
  ).toBeNull();

  // 2. Guest with invalid UUID token format -> null
  expect(
    await getOrderBySessionAndTokenServer("cs_guest_1", "invalid-token"),
  ).toBeNull();

  // 3. Guest with valid UUID token -> returns order
  const res = await getOrderBySessionAndTokenServer("cs_guest_1", validToken);
  expect(res).toMatchObject({ id: "order-guest" });
  expect(eq).toHaveBeenCalledWith("stripe_checkout_session_id", "cs_guest_1");
  expect(eq).toHaveBeenCalledWith("access_token", validToken);
});

it("prevents unauthorized access in getOrderReceiptServer", async () => {
  const validOrderId = "50000000-0000-4000-8000-000000000001";
  m.user.mockResolvedValue(null);

  // Guest with no token -> null
  expect(await getOrderReceiptServer(validOrderId)).toBeNull();

  // Invalid orderId uuid -> null
  expect(
    await getOrderReceiptServer(
      "not-a-uuid",
      "70000000-0000-4000-8000-000000000001",
    ),
  ).toBeNull();
});
