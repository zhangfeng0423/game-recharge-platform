/**
 * Database Types for Game Recharge Platform
 *
 * This file contains TypeScript type definitions for all database tables
 * Generated based on the schema in supabase/migrations/20250109_001_initial_schema.sql
 *
 * These types are used throughout the application for type safety and
 * IntelliSense support when working with Supabase data.
 */

// =============================================================================
// BASE INTERFACES
// =============================================================================

// Common fields that appear in multiple tables
export interface BaseTimestamps {
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

// =============================================================================
// TABLE INTERFACES
// =============================================================================

export interface Profile extends BaseTimestamps {
  id: string; // UUID, references auth.users.id
  role: "USER" | "MERCHANT" | "ADMIN";
  merchant_name?: string | null; // Only for MERCHANT role
}

export interface Game extends BaseTimestamps {
  id: string; // UUID
  name: GameName; // JSONB: {"en": "English Name", "zh": "中文名称"}
  description?: GameDescription | null; // JSONB: {"en": "Description", "zh": "描述"}
  banner_url?: string | null;
  merchant_id: string; // UUID, references profiles.id
  is_published?: boolean;
  sort_order?: number;
  category?: string;
}

export interface Sku extends BaseTimestamps {
  id: string; // UUID
  name: SkuName; // JSONB: {"en": "SKU Name", "zh": "商品名称"}
  description?: SkuDescription | null; // JSONB: {"en": "Description", "zh": "描述"}
  prices: SkuPrices; // JSONB: {"usd": 1099, "eur": 999}
  image_url?: string | null;
  game_id: string; // UUID, references games.id
  delivery_mode?: "auto" | "manual" | "showcase";
  auto_delivery_content?: string | null; // UI helper / merchant secret mirror
  external_url?: string | null;
  requires_recipient_info?: boolean;
  recipient_label?: { en: string; zh: string } | null;
  sku_fulfillment_secrets?: { content: string }[] | { content: string } | null;
}

export interface SkuFulfillmentSecret {
  sku_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Order extends BaseTimestamps {
  payment_mode?: "test" | "live" | "unknown" | "redeem";
  player_account?: string | null;
  game_server?: string | null;
  fulfillment_status?: "pending" | "fulfilled" | "attention";
  fulfilled_at?: string | null;
  fulfilled_by?: string | null;
  fulfillment_note?: string | null;
  id: string; // UUID
  user_id?: string | null; // UUID, references profiles.id (optional for guest orders)
  buyer_email?: string | null;
  access_token?: string;
  redeem_code_id?: string | null;
  sku_id: string; // UUID, references skus.id
  merchant_id: string; // UUID, references profiles.id
  amount: number; // Integer amount in cents (e.g., 1099 = $10.99)
  currency: string; // V1 always "usd"
  status: "pending" | "completed" | "failed";
  stripe_checkout_session_id?: string | null;
}

export interface RedeemCode extends BaseTimestamps {
  id: string;
  code: string;
  sku_id: string;
  merchant_id: string;
  batch_note?: string | null;
  custom_delivery_content?: string | null;
  status: "active" | "redeemed" | "disabled";
  redeemed_by_user_id?: string | null;
  redeemed_by_email?: string | null;
  order_id?: string | null;
  expires_at?: string | null;
  redeemed_at?: string | null;
}

// =============================================================================
// JSONB TYPE DEFINITIONS
// =============================================================================

export interface GameName {
  en: string;
  zh: string;
}

export interface GameDescription {
  en: string;
  zh: string;
}

export interface SkuName {
  en: string;
  zh: string;
}

export interface SkuDescription {
  en: string;
  zh: string;
}

export interface SkuPrices {
  usd: number; // Amount in cents
  eur?: number; // Reserved for future use
  gbp?: number; // Reserved for future use
  jpy?: number; // Reserved for future use
}

// =============================================================================
// RELATIONSHIP TYPES
// =============================================================================

// Game with its related SKUs and merchant info
export interface GameWithSkus extends Game {
  skus: Sku[];
  merchant_name?: string | null;
  profiles?: {
    merchant_name?: string | null;
  } | null;
}

// Order with all related data
export interface OrderWithDetails extends Order {
  user: Profile;
  sku: Sku;
  merchant: Profile;
}

// SKU with game information
export interface SkuWithGame extends Sku {
  game: Game;
}

// Merchant with their games and analytics
export interface MerchantWithAnalytics extends Profile {
  games: Game[];
  total_orders?: number;
  total_revenue?: number;
  completed_orders?: number;
}

// =============================================================================
// API INPUT/OUTPUT TYPES
// =============================================================================

// Input types for server actions and API endpoints
export interface CreateGameInput {
  name: GameName;
  description?: GameDescription;
  banner_url?: string;
}

export interface UpdateGameInput {
  name?: GameName;
  description?: GameDescription;
  banner_url?: string;
}

export interface CreateSkuInput {
  name: SkuName;
  description?: SkuDescription;
  prices: SkuPrices;
  image_url?: string;
  game_id: string;
}

export interface UpdateSkuInput {
  name?: SkuName;
  description?: SkuDescription;
  prices?: SkuPrices;
  image_url?: string;
}

export interface CreateOrderInput {
  sku_id: string;
  user_id?: string; // Will be auto-populated from auth
}

// =============================================================================
// ANALYTICS TYPES
// =============================================================================

export interface MerchantAnalytics {
  merchant_id: string;
  merchant_name: string | null;
  total_games: number;
  total_skus: number;
  total_orders: number;
  total_revenue: number; // In cents
  completed_orders: number;
  last_order_date: string | null;
}

export interface OrderAnalytics {
  total_orders: number;
  total_revenue: number;
  average_order_value: number;
  conversion_rate: number;
  orders_by_status: {
    pending: number;
    completed: number;
    failed: number;
  };
}

// =============================================================================
// STRIPE INTEGRATION TYPES
// =============================================================================

export interface StripeCheckoutSessionInput {
  sku_id: string;
  success_url: string;
  cancel_url: string;
  customer_email?: string;
}

export interface StripeCheckoutSessionOutput {
  session_id: string;
  session_url: string;
}

export interface StripeWebhookEvent {
  type: string;
  data: {
    object: {
      id: string;
      client_reference_id?: string; // Our order ID
      payment_status?: string;
      amount_total?: number;
      currency?: string;
    };
  };
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

// Helper type to make optional properties required
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Helper type for database rows (which may have additional columns)
export type DatabaseRow<T> = T & Record<string, any>;

// Helper type for API responses
export interface ApiResponse<T> {
  data: T;
  error?: string;
  success: boolean;
}

// Helper type for paginated responses
export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  has_more: boolean;
  page: number;
  page_size: number;
}

// Helper type for JSONB columns
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// =============================================================================
// DATABASE TYPE EXPORTS FOR SUPABASE CLIENT
// =============================================================================

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile & Record<string, unknown>;
        Insert: Omit<Profile, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Profile>;
        Relationships: [];
      };
      games: {
        Row: Game & Record<string, unknown>;
        Insert: Omit<Game, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Game>;
        Relationships: [];
      };
      skus: {
        Row: Sku & Record<string, unknown>;
        Insert: Omit<Sku, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Sku>;
        Relationships: [];
      };
      orders: {
        Row: Order & Record<string, unknown>;
        Insert: Omit<Order, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Order>;
        Relationships: [];
      };
      redeem_codes: {
        Row: RedeemCode & Record<string, unknown>;
        Insert: Omit<RedeemCode, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<RedeemCode>;
        Relationships: [];
      };
      sku_fulfillment_secrets: {
        Row: SkuFulfillmentSecret & Record<string, unknown>;
        Insert: {
          sku_id: string;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<SkuFulfillmentSecret>;
        Relationships: [];
      };
    };
    Views: {
      merchant_analytics: {
        Row: MerchantAnalytics & Record<string, unknown>;
        Relationships: [];
      };
    };
    Functions: {
      save_sku_with_secret: {
        Args: {
          p_id?: string | null;
          p_game_id: string;
          p_name: Json;
          p_description: Json;
          p_prices: Json;
          p_image_url?: string | null;
          p_delivery_mode: string;
          p_external_url?: string | null;
          p_requires_recipient_info: boolean;
          p_recipient_label: Json;
          p_is_published: boolean;
          p_secret_content?: string | null;
        };
        Returns: string;
      };
      revoke_redeem_code: {
        Args: {
          p_code_id: string;
        };
        Returns: boolean;
      };
      redeem_product_code: {
        Args: {
          p_code: string;
          p_sku_id?: string | null;
          p_user_id?: string | null;
          p_buyer_email?: string | null;
          p_player_account?: string | null;
          p_game_server?: string | null;
        };
        Returns: Json;
      };
      set_order_fulfillment: {
        Args: { p_order_id: string; p_status: string; p_note: string };
        Returns: undefined;
      };
      apply_checkout_event: {
        Args: {
          p_event_id: string;
          p_order_id: string;
          p_session_id: string;
          p_status: string;
          p_amount: number;
          p_currency: string;
          p_livemode: boolean;
        };
        Returns: undefined;
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      get_merchant_game_ids: {
        Args: {
          p_merchant_id: string;
        };
        Returns: {
          game_id: string;
        }[];
      };
      get_merchant_analytics: {
        Args: {
          p_merchant_id: string;
          p_start_date?: string | null;
          p_end_date?: string | null;
          p_timezone?: string;
        };
        Returns: {
          total_revenue: number;
          total_orders: number;
          completed_orders: number;
          pending_orders: number;
          failed_orders: number;
          unique_customers: number;
          average_order_value: number;
          conversion_rate: number;
          today_revenue: number;
          today_orders: number;
          yesterday_revenue: number;
          yesterday_orders: number;
          this_month_revenue: number;
          this_month_orders: number;
          last_month_revenue: number;
          last_month_orders: number;
          top_skus: Json;
          daily_sales: Json;
          revenue_by_game: Json;
          order_status_breakdown: Json;
          hourly_sales: Json;
          recent_orders: Json;
        }[];
      };
      get_merchant_orders_overview: {
        Args: {
          p_merchant_id: string;
          p_start_date?: string | null;
          p_end_date?: string | null;
          p_status?: string | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          orders: Json;
          total_count: number;
          summary: Json;
        }[];
      };
    };
    Enums: {
      profiles_role: "USER" | "MERCHANT" | "ADMIN";
      orders_status: "pending" | "completed" | "failed";
    };
    CompositeTypes: {
      [key: string]: never;
    };
  };
};
