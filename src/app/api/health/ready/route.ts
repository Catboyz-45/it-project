/**
 * หน้าที่ของไฟล์นี้: API /api/health/ready รองรับ GET; ตรวจสอบคำขอ เรียกกฎฝั่งเซิร์ฟเวอร์ และส่งผลลัพธ์ JSON โดยไม่เปิดเผยข้อมูลภายใน
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { storage } from "@/server/storage/s3";
import { checkMalwareScanner } from "@/server/media/malware";

export const dynamic = "force-dynamic";
const READINESS_TIMEOUT_MS = 3_000;

async function withTimeout(check: Promise<unknown>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      check,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("READINESS_CHECK_TIMEOUT")), READINESS_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** จุดเริ่มของคำขอ HTTP GET: อ่านข้อมูลโดยไม่แก้ไขข้อมูล และคืนสถานะที่เหมาะสมให้ผู้เรียก */
export async function GET() {
  try {
    await Promise.all([
      withTimeout(db.$queryRaw`SELECT 1`),
      withTimeout(storage().checkHealth()),
      withTimeout(checkMalwareScanner()),
    ]);
    return NextResponse.json({ status: "ready" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
