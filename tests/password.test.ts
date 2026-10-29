import { beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  reset: vi.fn(),
  getUser: vi.fn(),
  update: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/request-origin", () => ({
  getRequestOrigin: async () => "https://branch.example",
}));
vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseClientForServerActions: async () => ({
    auth: {
      resetPasswordForEmail: m.reset,
      getUser: m.getUser,
      updateUser: m.update,
    },
  }),
}));

import {
  requestPasswordReset,
  updatePassword,
} from "@/actions/password.actions";

beforeEach(() => vi.resetAllMocks());
it("sends recovery to the same origin as the verifier cookie", async () => {
  m.reset.mockResolvedValue({ error: null });
  const r = await requestPasswordReset({
    email: "owner@example.test",
    locale: "zh",
  });
  expect(r.data?.success).toBe(true);
  expect(m.reset).toHaveBeenCalledWith("owner@example.test", {
    redirectTo:
      "https://branch.example/zh/auth/callback?next=%2Fzh%2Fauth%2Freset",
  });
});
it("does not claim delivery when the provider rejects the request", async () => {
  m.reset.mockResolvedValue({ error: new Error("rate limited") });
  expect(
    (await requestPasswordReset({ email: "owner@example.test", locale: "en" }))
      .data?.success,
  ).toBe(false);
});
it("rejects mismatched passwords before contacting auth", async () => {
  const r = await updatePassword({
    password: "example-password",
    confirmPassword: "different-password",
  });
  expect(r.validationErrors).toBeDefined();
  expect(m.getUser).not.toHaveBeenCalled();
});
it("does not update passwords without a verified session", async () => {
  m.getUser.mockResolvedValue({
    data: { user: null },
    error: new Error("expired"),
  });
  expect(
    (
      await updatePassword({
        password: "example-password",
        confirmPassword: "example-password",
      })
    ).data?.success,
  ).toBe(false);
  expect(m.update).not.toHaveBeenCalled();
});
it("updates only the authenticated user", async () => {
  m.getUser.mockResolvedValue({
    data: { user: { id: "recovered-user" } },
    error: null,
  });
  m.update.mockResolvedValue({ error: null });
  expect(
    (
      await updatePassword({
        password: "example-password",
        confirmPassword: "example-password",
      })
    ).data?.success,
  ).toBe(true);
  expect(m.update).toHaveBeenCalledWith({ password: "example-password" });
});
