"use client";

import { useTranslations } from "next-intl";

interface MerchantDashboardErrorProps {
  error: string;
  onRetry?: () => void;
}

export function MerchantDashboardError({
  error,
  onRetry,
}: MerchantDashboardErrorProps) {
  const t = useTranslations("common");

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
      <div className="text-red-600 mb-4">
        <svg
          aria-hidden="true"
          className="mx-auto h-12 w-12"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-red-800 mb-2">Dashboard Error</h3>
      <p className="text-red-600 mb-4">{error}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
        >
          {t("retry")}
        </button>
      )}
    </div>
  );
}
