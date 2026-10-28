// Redirects must use the origin of the deployment being exercised.
export function getAppOrigin() {
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.trim()}`;
  }
  const value = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!value) throw new Error("Application URL is missing");
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Invalid application URL");
  if (process.env.VERCEL === "1" && url.protocol !== "https:")
    throw new Error("Deployment origin must use HTTPS");
  return url.origin;
}
