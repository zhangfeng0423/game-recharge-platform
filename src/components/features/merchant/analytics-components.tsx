"use client";

import { useTranslations } from "next-intl";

interface AnalyticsCardProps {
  title: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down" | "neutral";
}

export function AnalyticsCard({
  title,
  value,
  change,
  trend,
}: AnalyticsCardProps) {
  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h3 className="text-sm font-medium text-gray-600 mb-2">{title}</h3>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {change && (
        <p
          className={`text-sm ${
            trend === "up"
              ? "text-green-600"
              : trend === "down"
                ? "text-red-600"
                : "text-gray-500"
          }`}
        >
          {change}
        </p>
      )}
    </div>
  );
}

// Export AnalyticsCards as alias for AnalyticsCard
export const AnalyticsCards = AnalyticsCard;

interface MerchantDashboardHeaderProps {
  merchantName: string;
  totalRevenue: string;
  totalOrders: string;
}

export function MerchantDashboardHeader({
  merchantName,
  totalRevenue,
  totalOrders,
}: MerchantDashboardHeaderProps) {
  const t = useTranslations("common");

  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        {merchantName} {t("dashboard")}
      </h1>
      <p className="text-gray-600">
        Total Revenue: {totalRevenue} | Total Orders: {totalOrders}
      </p>
    </div>
  );
}

// Placeholder components for missing exports
export function DateRangeFilter() {
  return <div className="mb-4">Date Range Filter (Placeholder)</div>;
}

export function RecentOrdersTable() {
  return (
    <div className="bg-white p-4 rounded-lg">
      Recent Orders Table (Placeholder)
    </div>
  );
}

export function RevenueChart() {
  return (
    <div className="bg-white p-4 rounded-lg h-64">
      Revenue Chart (Placeholder)
    </div>
  );
}

export function TopProductsTable() {
  return (
    <div className="bg-white p-4 rounded-lg">
      Top Products Table (Placeholder)
    </div>
  );
}
