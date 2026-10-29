import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), ensure: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServerClientWithCookies: async () => ({
    auth: { getUser: mocks.getUser },
  }),
  createSupabaseClientForServerActions: vi.fn(),
}));
vi.mock("@/lib/profiles", () => ({ ensureProfile: mocks.ensure }));

import { getCurrentUser } from "@/actions/auth.actions";

describe("verified server authentication", () => {
  beforeEach(() => vi.resetAllMocks());
  it("does not create a profile without a verified user", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("No session"),
    });
    expect(await getCurrentUser()).toBeNull();
    expect(mocks.ensure).not.toHaveBeenCalled();
  });
  it("reads role from the profile, never an email pattern", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "u1", email: "admin@example.com" } },
      error: null,
    });
    mocks.ensure.mockResolvedValue({ role: "USER" });
    expect(await getCurrentUser()).toEqual({
      id: "u1",
      email: "admin@example.com",
      role: "USER",
    });
  });
  it("fails closed when profile lookup fails", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    mocks.ensure.mockRejectedValue(new Error("Database unavailable"));
    await expect(getCurrentUser()).rejects.toThrow("Database unavailable");
  });
});
