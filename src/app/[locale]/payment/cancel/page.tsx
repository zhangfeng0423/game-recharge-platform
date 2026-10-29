import { XCircle } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

interface PaymentCancelPageProps {
  params: Promise<{
    locale: string;
  }>;
  searchParams: Promise<{
    session_id?: string;
  }>;
}

export default async function PaymentCancelPage({
  params,
  searchParams,
}: PaymentCancelPageProps) {
  const { locale } = await params;
  const { session_id } = await searchParams;
  const t = await getTranslations("common");

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Cancel Icon */}
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-red-100 p-6">
            <XCircle className="h-16 w-16 text-red-600" />
          </div>
        </div>

        {/* Cancel Message */}
        <h1 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">
          {t("paymentCanceled")}
        </h1>
        <p className="mb-8 text-lg text-gray-600 dark:text-gray-300">
          {t("paymentCanceledMessage")}
        </p>

        {/* Session ID */}
        <div className="mb-8 p-4 bg-white rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 mb-2">{t("transactionId")}</p>
          <p className="font-mono text-sm text-gray-900 dark:text-white">
            {session_id || "N/A"}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          <Link
            href={`/${locale}`}
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            {t("backToStore") || "Back to Store"}
          </Link>
          <Link
            href={`/${locale}/games`}
            className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            {t("tryAgain") || "Try Again"}
          </Link>
        </div>

        {/* Help Message */}
        <div className="mt-12 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">
            {t("helpful") || "Helpful Tips"}
          </h3>
          <ul className="text-sm text-blue-800 space-y-1 text-left">
            <li>
              •{" "}
              {t("paymentSecurityTip") ||
                "Your payment information is always secure"}
            </li>
            <li>
              • {t("tryAgainTip") || "You can try the purchase again anytime"}
            </li>
            <li>
              •{" "}
              {t("contactSupportTip") ||
                "Contact support if you continue to have issues"}
            </li>
          </ul>
        </div>

        {/* Support Info */}
        <div className="mt-8 text-sm text-gray-500">
          <p>
            {t("support.needHelp") || "Need help?"}{" "}
            <a
              href="mailto:support@example.com"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              {t("support.contactSupport") || "Contact Support"}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
