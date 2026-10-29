import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n.ts");
const config: NextConfig = {
  distDir: process.env.BUILD_DIR ?? ".next",
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "placehold.co" }],
  },
};
export default withNextIntl(config);
