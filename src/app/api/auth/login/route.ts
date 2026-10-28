import { NextResponse } from "next/server";
import { loginAction } from "@/actions/auth.actions";
export async function POST(request: Request) {
  try {
    const result = await loginAction(await request.json());
    return NextResponse.json(
      result.data ?? { success: false, message: "Invalid login request" },
      { status: result.data?.success ? 200 : 401 },
    );
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request" },
      { status: 400 },
    );
  }
}
