import { beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ verify: vi.fn(), exchange: vi.fn() }));
vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseClientForServerActions: async () => ({
    auth: { verifyOtp: m.verify, exchangeCodeForSession: m.exchange },
  }),
}));
vi.mock("@/lib/profiles", () => ({ ensureProfile: vi.fn() }));

import { GET } from "@/app/[locale]/auth/callback/route";

beforeEach(() => vi.resetAllMocks());
it("verifies a recovery token on the server and removes it from the destination", async () => {
  m.verify.mockResolvedValue({ error: null });
  const response = await GET(
    new Request(
      "https://app.example/zh/auth/callback?token_hash=fixture&type=recovery&next=https://untrusted.example",
    ),
    { params: Promise.resolve({ locale: "zh" }) },
  );
  expect(m.verify).toHaveBeenCalledWith({
    token_hash: "fixture",
    type: "recovery",
  });
  expect(response.headers.get("location")).toBe(
    "https://app.example/zh/auth/reset",
  );
  expect(m.exchange).not.toHaveBeenCalled();
});
it("rejects expired recovery tokens without opening the password form", async () => {
  m.verify.mockResolvedValue({ error: new Error("expired") });
  const response = await GET(
    new Request(
      "https://app.example/en/auth/callback?token_hash=fixture&type=recovery",
    ),
    { params: Promise.resolve({ locale: "en" }) },
  );
  expect(response.headers.get("location")).toBe(
    "https://app.example/en/auth/forgot?error=expired",
  );
});
