import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/db";

export const dynamic = "force-dynamic";

// ตรวจว่าระบบยังทำงานอยู่ ใช้กับ health check ของ Docker และตัวจัดการเครื่อง
export async function GET() {
  try {
    await getDatabase().$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
