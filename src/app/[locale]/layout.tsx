import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  // 确保传入的 `locale` 是有效的
  if (!routing.locales.includes(locale as "en" | "zh")) {
    notFound();
  }

  // 提供所有共享的消息
  setRequestLocale(locale);
  const messages = await getMessages({ locale });

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          {process.env.STRIPE_SECRET_KEY?.trim().startsWith("sk_test_") && (
            <aside className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950">
              {locale === "zh"
                ? "当前为支付测试模式，商品与订单仅用于流程验证，请勿实际充值。"
                : "Payment test mode. Products and orders are for workflow verification; do not deliver real game credit."}
            </aside>
          )}
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
