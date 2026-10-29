import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  user: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/actions/auth.actions", () => ({ getCurrentUser: m.user }));
vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseAdminClient: () => ({ rpc: m.rpc }),
  createSupabaseServerClientWithCookies: async () => ({ from: m.from }),
}));

import {
  generateRedeemCodesAction,
  redeemCodeAction,
} from "@/actions/redeem.actions";

beforeEach(() => {
  vi.resetAllMocks();
  m.user.mockResolvedValue({
    id: "user-1",
    email: "user@example.test",
    role: "USER",
  });
});

describe("redeem code action", () => {
  it("rejects codes that are too short via Zod validation", async () => {
    const res = await redeemCodeAction({ code: "ABC", locale: "en" });
    expect(res.validationErrors).toBeDefined();
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it("calls database RPC with formatted code and returns order info", async () => {
    m.rpc.mockResolvedValue({
      data: {
        order_id: "order-123",
        access_token: "token-456",
        fulfillment_status: "fulfilled",
        fulfillment_note: "https://download.example/pkg.zip",
        sku_id: "sku-1",
      },
      error: null,
    });

    const res = await redeemCodeAction({
      code: "nx-abcd-1234",
      buyerEmail: "buyer@example.test",
      locale: "zh",
    });

    expect(m.rpc).toHaveBeenCalledWith(
      "redeem_product_code",
      expect.objectContaining({
        p_code: "NX-ABCD-1234",
        p_buyer_email: "buyer@example.test",
      }),
    );
    expect(res.data?.success).toBe(true);
    expect(res.data?.orderId).toBe("order-123");
    expect(res.data?.fulfillmentNote).toBe("https://download.example/pkg.zip");
  });

  it("maps database errors to friendly user messages", async () => {
    m.rpc.mockResolvedValue({
      data: null,
      error: { message: "CODE_ALREADY_USED" },
    });

    const res = await redeemCodeAction({ code: "NX-USED-CODE", locale: "zh" });
    expect(res.data?.success).toBe(false);
    expect(res.data?.message).toContain("已被使用");
  });
});

describe("generate redeem codes action", () => {
  const validSkuId = "40000000-0000-4000-8000-000000000001";

  it("rejects regular users from generating codes", async () => {
    m.user.mockResolvedValue({ id: "buyer-1", role: "USER" });
    const res = await generateRedeemCodesAction({
      skuId: validSkuId,
      count: 5,
      locale: "en",
    });
    expect(res.serverError).toBeDefined();
  });

  it("allows merchant or admin to batch generate redeem codes", async () => {
    m.user.mockResolvedValue({ id: "merchant-1", role: "MERCHANT" });
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    m.from.mockImplementation((table: string) => {
      if (table === "skus") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { id: validSkuId, games: { merchant_id: "merchant-1" } },
                error: null,
              }),
            }),
          }),
        };
      }
      return { insert: insertMock };
    });

    const res = await generateRedeemCodesAction({
      skuId: validSkuId,
      count: 3,
      batchNote: "Partner batch",
      locale: "en",
    });

    expect(res.data?.success).toBe(true);
    expect(res.data?.count).toBe(3);
    expect(res.data?.codes).toHaveLength(3);
    expect(insertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          sku_id: validSkuId,
          merchant_id: "merchant-1",
          batch_note: "Partner batch",
        }),
      ]),
    );
  });

  it("rejects merchant from generating codes for another merchant's SKU", async () => {
    m.user.mockResolvedValue({ id: "merchant-1", role: "MERCHANT" });
    m.from.mockImplementation((table: string) => {
      if (table === "skus") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: validSkuId,
                  games: { merchant_id: "other-merchant" },
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return { insert: vi.fn() };
    });

    const res = await generateRedeemCodesAction({
      skuId: validSkuId,
      count: 3,
      locale: "en",
    });

    expect(res.serverError).toBeDefined();
    expect(res.data).toBeUndefined();
  });
});
