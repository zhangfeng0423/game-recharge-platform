"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { logoutAction } from "@/actions/auth.actions";

interface User {
  id: string;
  email: string;
  role: string;
}
export function UserStatus({
  initialUser,
  locale,
}: {
  initialUser: User | null;
  locale: string;
}) {
  const t = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const isGameDetailPage = pathname?.includes("/games/");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  if (!initialUser) return <Link href={`/${locale}/auth`}>{t("login")}</Link>;
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span>{initialUser.email}</span>
      <Link href={`/${locale}/orders`}>
        {locale === "zh" ? "我的订单" : "My orders"}
      </Link>
      {initialUser.role !== "USER" && (
        <Link href={`/${locale}/dashboard/merchant`}>
          {locale === "zh" ? "商户后台" : "Merchant portal"}
        </Link>
      )}
      {initialUser.role === "ADMIN" && (
        <Link href={`/${locale}/dashboard/admin`}>Admin</Link>
      )}
      {!isGameDetailPage && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(false);
            try {
              const result = await logoutAction();
              if (result.data?.success) {
                router.refresh();
              } else {
                setError(true);
              }
            } catch {
              setError(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          {locale === "zh" ? "退出" : "Sign out"}
        </button>
      )}
      {error && (
        <span role="alert">
          {locale === "zh"
            ? "退出失败，请重试"
            : "Sign out failed. Please retry."}
        </span>
      )}
    </div>
  );
}
