import { afterEach, expect, it, vi } from "vitest";
import { getAppOrigin } from "@/lib/app-origin";

afterEach(() => vi.unstubAllEnvs());
it("uses the current preview origin instead of a production or localhost redirect", () => {
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("VERCEL_URL", "branch.example.vercel.app");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  expect(getAppOrigin()).toBe("https://branch.example.vercel.app");
});
it("normalizes whitespace in the configured deployment origin", () => {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://store.example/\n");
  expect(getAppOrigin()).toBe("https://store.example");
});
it("rejects insecure hosted redirects", () => {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://store.example");
  expect(() => getAppOrigin()).toThrow(/HTTPS/);
});
