import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/auth.actions";
export async function POST() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { success: false, message: "Authentication required" },
      { status: 401 },
    );
  return NextResponse.json({ success: true, role: user.role });
}
