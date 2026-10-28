"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionClient } from "@/lib/action-client";
import { getAppOrigin } from "@/lib/app-origin";
import { ensureProfile } from "@/lib/profiles";
import {
  createSupabaseClientForServerActions,
  createSupabaseServerClientWithCookies,
} from "@/lib/supabaseServer";
export interface AuthResult {
  success: boolean;
  message: string;
  user?: { id: string; email: string; role: string };
  redirectUrl?: string;
}
export async function getCurrentUser() {
  const db = await createSupabaseServerClientWithCookies();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) return null;
  const profile = await ensureProfile(user);
  return { id: user.id, email: user.email ?? "", role: profile.role };
}
export const loginAction = actionClient
  .schema(z.object({ email: z.string().email(), password: z.string().min(1) }))
  .action(async ({ parsedInput }): Promise<AuthResult> => {
    const db = await createSupabaseClientForServerActions();
    const { data, error } = await db.auth.signInWithPassword(parsedInput);
    if (error || !data.user)
      return {
        success: false,
        message: "Invalid login credentials or email not confirmed.",
      };
    const profile = await ensureProfile(data.user);
    revalidatePath("/", "layout");
    return {
      success: true,
      message: "Login successful",
      user: {
        id: data.user.id,
        email: data.user.email ?? "",
        role: profile.role,
      },
    };
  });
export const registerAction = actionClient
  .schema(
    z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
        confirmPassword: z.string(),
        role: z.enum(["USER", "MERCHANT"]),
        merchantName: z.string().trim().max(255).optional(),
        locale: z.enum(["en", "zh"]).default("en"),
      })
      .refine((v) => v.password === v.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
      })
      .refine((v) => v.role !== "MERCHANT" || !!v.merchantName, {
        message: "Merchant name is required",
        path: ["merchantName"],
      }),
  )
  .action(async ({ parsedInput }): Promise<AuthResult> => {
    const db = await createSupabaseClientForServerActions();
    const origin = getAppOrigin();
    const { data, error } = await db.auth.signUp({
      email: parsedInput.email,
      password: parsedInput.password,
      options: {
        emailRedirectTo: `${origin}/${parsedInput.locale}/auth/callback`,
        data: {
          role: parsedInput.role,
          merchant_name:
            parsedInput.role === "MERCHANT" ? parsedInput.merchantName : null,
        },
      },
    });
    if (error || !data.user)
      return {
        success: false,
        message: "Registration could not be completed. Please try again.",
      };
    // A database trigger creates the profile. Email-confirmation signups have no session yet.
    revalidatePath("/", "layout");
    return {
      success: true,
      message: data.session
        ? "Registration successful"
        : "Check your email to confirm your account.",
      ...(data.session
        ? {
            user: {
              id: data.user.id,
              email: data.user.email ?? "",
              role: parsedInput.role,
            },
          }
        : {}),
    };
  });
export const logoutAction = actionClient.action(
  async (): Promise<AuthResult> => {
    const db = await createSupabaseClientForServerActions();
    const { error } = await db.auth.signOut();
    if (error)
      return {
        success: false,
        message: "Unable to sign out. Please try again.",
      };
    revalidatePath("/", "layout");
    return { success: true, message: "Logged out" };
  },
);
