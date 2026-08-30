/**
 * หน้าที่ของไฟล์นี้: API /api/admin/audit รองรับ GET; ตรวจสอบคำขอ เรียกกฎฝั่งเซิร์ฟเวอร์ และส่งผลลัพธ์ JSON โดยไม่เปิดเผยข้อมูลภายใน
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { cmsError, cmsSession } from "@/server/cms/http";
const schema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(30), query: z.string().trim().max(200).default(""), action: z.string().trim().max(120).default("") }).strict();
/** จุดเริ่มของคำขอ HTTP GET: อ่านข้อมูลโดยไม่แก้ไขข้อมูล และคืนสถานะที่เหมาะสมให้ผู้เรียก */
export async function GET(request: NextRequest) { const session = await cmsSession(); if (!session || session.admin.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 }); try { const query = schema.parse(Object.fromEntries(request.nextUrl.searchParams)); const where = { ...(query.action ? { action: { contains: query.action, mode: "insensitive" as const } } : {}), ...(query.query ? { OR: [{ action: { contains: query.query, mode: "insensitive" as const } }, { targetId: { contains: query.query, mode: "insensitive" as const } }, { actor: { displayName: { contains: query.query, mode: "insensitive" as const } } }] } : {}) }; const [items, total] = await db.$transaction([db.auditLog.findMany({ where, include: { actor: { select: { displayName: true, username: true } } }, orderBy: { createdAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }), db.auditLog.count({ where })]); return NextResponse.json({ items: items.map(item => ({ ...item, id: item.id.toString() })), total, page: query.page, pageCount: Math.max(1, Math.ceil(total / query.pageSize)) }); } catch (error) { return cmsError(error); } }
