"use server";
import { z } from "zod";
import { actionClient } from "@/lib/action-client";
import { createSupabaseServerClientWithCookies } from "@/lib/supabaseServer";
import { getCurrentUser } from "./auth.actions";

async function findOrder(
  column: "id" | "stripe_checkout_session_id",
  value: string,
) {
  const user = await getCurrentUser();
  if (!user) return null;
  const db = await createSupabaseServerClientWithCookies();
  const { data, error } = await db
    .from("orders")
    .select("*,sku:skus(*,game:games(*))")
    .eq(column, value)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error("Unable to load order");
  return data;
}
export const getOrderById = actionClient
  .schema(z.object({ orderId: z.string().uuid() }))
  .action(async ({ parsedInput }) => {
    const data = await findOrder("id", parsedInput.orderId);
    return {
      success: !!data,
      message: data ? "Order found" : "Order not found",
      data,
    };
  });
export const getOrderBySessionId = actionClient
  .schema(z.object({ sessionId: z.string().min(1).max(255) }))
  .action(async ({ parsedInput }) => {
    const data = await findOrder(
      "stripe_checkout_session_id",
      parsedInput.sessionId,
    );
    return {
      success: !!data,
      message: data ? "Order found" : "Order not found",
      data,
    };
  });
export async function getOrderByIdServer(id: string) {
  return findOrder("id", id);
}
export async function getOrderBySessionIdServer(id: string) {
  return findOrder("stripe_checkout_session_id", id);
}
