"use client";
import { useLocale } from "next-intl";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const locale = useLocale();
  return (
    <main className="mx-auto max-w-xl space-y-4 p-10">
      <h1>
        {locale === "zh" ? "暂时无法加载数据" : "Unable to load data right now"}
      </h1>
      <p>
        {locale === "zh"
          ? "请稍后重试。如问题持续，请联系平台维护者。"
          : "Please retry later. Contact the platform operator if the problem persists."}
      </p>
      <button type="button" onClick={reset}>
        {locale === "zh" ? "重试" : "Retry"}
      </button>
    </main>
  );
}
