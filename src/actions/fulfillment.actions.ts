"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionClient } from "@/lib/action-client";
import { createSupabaseServerClientWithCookies } from "@/lib/supabaseServer";
import { getCurrentUser } from "./auth.actions";
export const fulfillOrder = actionClient
  .schema(
    z.object({
      orderId: z.uuid(),
      status: z.enum(["fulfilled", "attention"]),
      note: z.string().trim().min(1).max(1000),
      confirmed: z.literal(true),
      locale: z.enum(["en", "zh"]),
    }),
  )
  .action(async ({ parsedInput }) => {
    const user = await getCurrentUser();
    if (!user || user.role === "USER")
      throw new Error("Merchant access required");
    const db = await createSupabaseServerClientWithCookies();
    const { error } = await db.rpc("set_order_fulfillment", {
      p_order_id: parsedInput.orderId,
      p_status: parsedInput.status,
      p_note: parsedInput.note,
    });
    if (error) throw new Error("Unable to confirm delivery");
    revalidatePath(`/${parsedInput.locale}/dashboard`);
    revalidatePath(`/${parsedInput.locale}/orders`);
    return { success: true };
  });
