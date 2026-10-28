import { beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ user: vi.fn(), db: vi.fn() }));
vi.mock("@/actions/auth.actions", () => ({ getCurrentUser: m.user }));
vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServerClientWithCookies: m.db,
}));

import {
  getOrderByIdServer,
  getOrderBySessionIdServer,
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
