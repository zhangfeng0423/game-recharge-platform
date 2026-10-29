import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  // Default to English if no locale in path, but preserve all query parameters
  const target = new URL(`/en/auth/callback${url.search}`, url.origin);
  return NextResponse.redirect(target);
}
