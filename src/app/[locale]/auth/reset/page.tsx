import { redirect } from "next/navigation";
import { PasswordForm } from "@/components/features/password-form";
import { createSupabaseServerClientWithCookies } from "@/lib/supabaseServer";
export default async function ResetPassword({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const db = await createSupabaseServerClientWithCookies();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) redirect(`/${locale}/auth/forgot`);
  return <PasswordForm reset />;
}
