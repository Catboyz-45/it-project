/**
 * หน้าที่ของไฟล์นี้: API /api/admin/users/[id]/reset-password รองรับ POST; ตรวจสอบคำขอ เรียกกฎฝั่งเซิร์ฟเวอร์ และส่งผลลัพธ์ JSON โดยไม่เปิดเผยข้อมูลภายใน
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { NextRequest, NextResponse } from "next/server";
import { currentSession } from "@/server/auth/session";
import { resetAdminPassword } from "@/server/auth/admin-users";
import { assertSameOrigin } from "@/server/security/request";
import { requestContext } from "@/server/security/request";
import { audit } from "@/server/auth/audit";
/** จุดเริ่มของคำขอ HTTP POST: สร้างข้อมูลหรือสั่งให้เกิดการทำงาน และคืนสถานะที่เหมาะสมให้ผู้เรียก */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { if (!assertSameOrigin(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 }); const session = await currentSession(); if (!session?.twoFactorAt || session.admin.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 }); const id = (await params).id; const temporaryPassword = await resetAdminPassword(id); await audit({ actorId: session.adminId, action: "ADMIN_PASSWORD_RESET", targetType: "Admin", targetId: id, result: "SUCCESS", ...requestContext(request) }); return NextResponse.json({ temporaryPassword }, { headers: { "Cache-Control": "no-store" } }); }
