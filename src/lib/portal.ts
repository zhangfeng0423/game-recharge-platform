import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/auth.actions";
export async function requireUser(
  locale: string,
  merchant = false,
  admin = false,
) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/auth`);
  if ((merchant && user.role === "USER") || (admin && user.role !== "ADMIN"))
    redirect(`/${locale}`);
  return user;
}
