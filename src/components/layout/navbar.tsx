import Link from "next/link";
import { getCurrentUser } from "@/actions/auth.actions";
import { UserStatus } from "@/components/features/user-status";
import { siteConfig } from "@/config/site";

export async function Navbar({ locale }: { locale: string }) {
  const zh = locale === "zh";
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200/80 bg-white/90 backdrop-blur-md dark:border-gray-800/80 dark:bg-gray-900/90">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-6">
          <Link href={`/${locale}`} className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 font-bold text-white shadow-sm transition-transform group-hover:scale-105">
              <span>{siteConfig.logoText}</span>
            </div>
            <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
              {siteConfig.name}
            </span>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-5 text-sm font-medium">
            <Link
              href={`/${locale}`}
              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
            >
              {zh ? "商品商城" : "Storefront"}
            </Link>
            <Link
              href={`/${locale}/redeem`}
              className="inline-flex items-center gap-1.5 text-blue-600 font-semibold hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              <span>🎟️</span>
              <span>{zh ? "卡密兑换" : "Redeem Code"}</span>
            </Link>
          </nav>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-4">
          {/* Language Toggle */}
          <div className="flex items-center rounded-lg border border-gray-200 p-0.5 text-xs font-semibold dark:border-gray-800">
            <Link
              href="/en"
              className={`rounded px-2 py-1 transition-colors ${
                locale === "en"
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              EN
            </Link>
            <Link
              href="/zh"
              className={`rounded px-2 py-1 transition-colors ${
                locale === "zh"
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              ZH
            </Link>
          </div>

          {/* User Account / Login */}
          <UserStatus initialUser={user} locale={locale} />
        </div>
      </div>
    </header>
  );
}
