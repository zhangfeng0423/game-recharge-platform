import { NextResponse } from "next/server";
import { logoutAction } from "@/actions/auth.actions";
export async function POST() {
  const result = await logoutAction();
  return NextResponse.json(result.data ?? { success: false }, {
    status: result.data?.success ? 200 : 500,
  });
}
