import Link from "next/link";
import { siteConfig } from "@/config/site";

export function Footer({ locale }: { locale: string }) {
  const zh = locale === "zh";
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-200 bg-white py-10 dark:border-gray-800 dark:bg-gray-900 mt-16">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
              {siteConfig.logoText}
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {siteConfig.name}
            </span>
            <span className="text-xs text-gray-400">
              © {year} All rights reserved.
            </span>
          </div>

          <div className="flex items-center gap-6 text-xs text-gray-500 dark:text-gray-400">
            <Link
              href={`/${locale}`}
              className="hover:text-gray-900 dark:hover:text-white"
            >
              {zh ? "商城" : "Store"}
            </Link>
            <Link
              href={`/${locale}/redeem`}
              className="hover:text-gray-900 dark:hover:text-white"
            >
              {zh ? "兑换中心" : "Redeem"}
            </Link>
            <Link
              href={`/${locale}/orders`}
              className="hover:text-gray-900 dark:hover:text-white"
            >
              {zh ? "我的订单" : "Orders"}
            </Link>
            <a
              href={siteConfig.links.github}
              target="_blank"
              rel="noreferrer"
              className="hover:text-gray-900 dark:hover:text-white"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
