/**
 * Types for merchant analytics
 */

export interface MerchantAnalytics {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  conversionRate: number;
  period: string;
}

export interface GameAnalytics {
  gameId: string;
  gameName: string;
  totalOrders: number;
  totalRevenue: number;
  topSkus: SkuAnalytics[];
}

export interface SkuAnalytics {
  skuId: string;
  skuName: string;
  quantity: number;
  revenue: number;
}

export interface AnalyticsTimeRange {
  startDate: string;
  endDate: string;
  period: "day" | "week" | "month";
}

// Utility classes for formatting
export class CurrencyFormatter {
  static format(amount: number, currency = "USD", locale = "en-US"): string {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(amount / 100); // Convert from cents
  }
}

export class DateFormatter {
  static format(date: string | Date, locale = "en-US"): string {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(date));
  }

  static formatRelative(date: string | Date, locale = "en-US"): string {
    const now = new Date();
    const target = new Date(date);
    const diffInDays = Math.floor(
      (now.getTime() - target.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffInDays === 0) return "Today";
    if (diffInDays === 1) return "Yesterday";
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return DateFormatter.format(date, locale);
  }
}
