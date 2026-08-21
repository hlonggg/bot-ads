import { NextRequest, NextResponse } from "next/server";
import { verifyAdminInitData } from "@/lib/panelAuth";

export async function GET(req: NextRequest) {
  const initData = req.nextUrl.searchParams.get("initData") || "";
  const admin = verifyAdminInitData(initData);
  return NextResponse.json({ isAdmin: !!admin });
}
