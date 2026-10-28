import { headers } from "next/headers";
import { getAppOrigin } from "./app-origin";
// Server Actions validate Origin against the request host before invoking this code.
// Preserve the actual branch alias so the PKCE verifier cookie stays on one origin.
export async function getRequestOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("host");
  if (origin && host) {
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      return getAppOrigin();
    }
    if (
      url.host === host &&
      (url.protocol === "https:" ||
        (url.protocol === "http:" && process.env.VERCEL !== "1"))
    )
      return url.origin;
  }
  return getAppOrigin();
}
