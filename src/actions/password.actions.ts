"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionClient } from "@/lib/action-client";
import { getRequestOrigin } from "@/lib/request-origin";
import { createSupabaseClientForServerActions } from "@/lib/supabaseServer";
export const requestPasswordReset = actionClient
  .schema(
    z.object({
      email: z.string().trim().email().max(254),
      locale: z.enum(["en", "zh"]),
    }),
  )
  .action(async ({ parsedInput }) => {
    const db = await createSupabaseClientForServerActions();
    const origin = await getRequestOrigin();
    const next = `/${parsedInput.locale}/auth/reset`;
    const { error } = await db.auth.resetPasswordForEmail(parsedInput.email, {
      redirectTo: `${origin}/${parsedInput.locale}/auth/callback?next=${encodeURIComponent(next)}`,
    });
    if (error)
      return {
        success: false,
        message:
          parsedInput.locale === "zh"
            ? "暂时无法发送重置邮件，请稍后重试。"
            : "Unable to send a reset email right now. Retry later.",
      };
    // Do not disclose whether an address belongs to an account.
    return {
      success: true,
      message:
        parsedInput.locale === "zh"
          ? "如果该邮箱已注册，你会收到重置邮件。请在当前浏览器中打开邮件链接。"
          : "If this email is registered, a reset email will arrive. Open its link in this browser.",
    };
  });
export const updatePassword = actionClient
  .schema(
    z
      .object({
        password: z.string().min(8).max(128),
        confirmPassword: z.string(),
      })
      .refine((v) => v.password === v.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
      }),
  )
  .action(async ({ parsedInput }) => {
    const db = await createSupabaseClientForServerActions();
    const {
      data: { user },
      error,
    } = await db.auth.getUser();
    if (error || !user)
      return {
        success: false,
        message: "Reset link is invalid or expired. Request a new email.",
      };
    const { error: updateError } = await db.auth.updateUser({
      password: parsedInput.password,
    });
    if (updateError)
      return {
        success: false,
        message: "Unable to update password. Request a new email or retry.",
      };
    revalidatePath("/", "layout");
    return { success: true, message: "Password updated" };
  });
