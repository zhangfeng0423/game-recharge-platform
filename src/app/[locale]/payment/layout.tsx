"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

interface PaymentLayoutProps {
  children: ReactNode;
}

export default function PaymentLayout({ children }: PaymentLayoutProps) {
  const t = useTranslations("payment");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
            <h1 className="text-2xl font-bold text-center">
              {t("gameRechargePlatform")}
            </h1>
            <p className="text-center text-blue-100 mt-2">
              {t("securePaymentProcessing")}
            </p>
          </div>

          {/* Content */}
          <div className="p-6 md:p-8">{children}</div>

          {/* Footer */}
          <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex flex-col md:flex-row justify-between items-center text-sm text-slate-600 dark:text-slate-400">
              <div className="flex items-center space-x-2 mb-2 md:mb-0">
                <svg
                  aria-hidden="true"
                  className="w-4 h-4 text-green-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{t("securedBySslEncryption")}</span>
              </div>
              <div className="flex items-center space-x-4">
                <span>{t("customerSupport247")}</span>
                <span>•</span>
                <span>{t("instantDelivery")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
