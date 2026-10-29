export const siteConfig = {
  name: process.env.NEXT_PUBLIC_SITE_NAME?.trim() || "NexusStore",
  logoText: process.env.NEXT_PUBLIC_SITE_LOGO?.trim() || "NX",
  allowMerchantSignup: process.env.NEXT_PUBLIC_ALLOW_MERCHANT_SIGNUP === "true",
  hero: {
    en: {
      badge: "Instant Digital Delivery & Redeem Center",
      title: "Digital Products & SaaS Storefront",
      subtitle:
        "Instant delivery with Stripe Checkout, or redeem your code purchased from partner platforms.",
      browseButton: "Explore Products",
      redeemButton: "Redeem Code",
    },
    zh: {
      badge: "即时自动发货 · 跨平台卡密核销",
      title: "精选数字商品与 SaaS 售卖中心",
      subtitle:
        "支持 Stripe 在线支付与自动发货；也支持在第三方平台下单后使用兑换码一键提货。",
      browseButton: "浏览全部商品",
      redeemButton: "兑换码提货",
    },
  },
  links: {
    github: "https://github.com/zhangfeng0423",
  },
};
