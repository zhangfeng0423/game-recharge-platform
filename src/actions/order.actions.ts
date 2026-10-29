"use server";
import { z } from "zod";
import { actionClient } from "@/lib/action-client";
import {
  createSupabaseAdminClient,
  createSupabaseServerClientWithCookies,
} from "@/lib/supabaseServer";
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

export async function getOrderBySessionAndTokenServer(
  sessionId: string,
  token?: string,
) {
  if (!sessionId?.trim()) return null;
  const user = await getCurrentUser();
  const db = createSupabaseAdminClient();

  const isTokenUuid = token && z.string().uuid().safeParse(token).success;

  let query = db
    .from("orders")
    .select("*,sku:skus(*,game:games(*))")
    .eq("stripe_checkout_session_id", sessionId);

  if (isTokenUuid) {
    query = query.eq("access_token", token);
  } else if (user) {
    query = query.eq("user_id", user.id);
  } else {
    // Disallow reading guest receipt without the verified secret access_token
    return null;
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function getOrderReceiptServer(
  orderId: string,
  accessToken?: string,
) {
  if (!z.string().uuid().safeParse(orderId).success) return null;
  const user = await getCurrentUser();
  const isTokenUuid =
    accessToken && z.string().uuid().safeParse(accessToken).success;

  if (!isTokenUuid && !user) {
    return null;
  }

  const db = createSupabaseAdminClient();
  let query = db
    .from("orders")
    .select("*,sku:skus(*,game:games(*))")
    .eq("id", orderId);

  if (isTokenUuid) {
    query = query.eq("access_token", accessToken);
  } else if (user) {
    if (user.role !== "ADMIN") {
      query = query.or(`user_id.eq.${user.id},merchant_id.eq.${user.id}`);
    }
  }

  const { data, error } = await query.maybeSingle();
  if (error) return null;
  return data;
}
