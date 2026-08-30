/**
 * หน้าที่ของไฟล์นี้: API /api/admin/taxonomies/[kind] รองรับ GET, POST; ตรวจสอบคำขอ เรียกกฎฝั่งเซิร์ฟเวอร์ และส่งผลลัพธ์ JSON โดยไม่เปิดเผยข้อมูลภายใน
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { NextRequest, NextResponse } from "next/server";
import { TaxonomyService } from "@/server/cms/taxonomy.service";
import { cmsError, cmsSession, validMutation } from "@/server/cms/http";
import { taxonomyKindSchema } from "@/server/cms/schemas";
import { requestContext } from "@/server/security/request";
import { invalidatePublicContent } from "@/server/services/public-cache";
const service = new TaxonomyService();
/** จุดเริ่มของคำขอ HTTP GET: อ่านข้อมูลโดยไม่แก้ไขข้อมูล และคืนสถานะที่เหมาะสมให้ผู้เรียก */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ kind: string }> }) { const session = await cmsSession(); if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 }); try { return NextResponse.json({ items: await service.list(taxonomyKindSchema.parse((await params).kind)) }); } catch (error) { return cmsError(error); } }
/** จุดเริ่มของคำขอ HTTP POST: สร้างข้อมูลหรือสั่งให้เกิดการทำงาน และคืนสถานะที่เหมาะสมให้ผู้เรียก */
export async function POST(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) { const session = await cmsSession(); if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 }); if (!validMutation(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 }); try { const item = await service.create(taxonomyKindSchema.parse((await params).kind), await request.json(), { id: session.adminId, role: session.admin.role }, requestContext(request)); invalidatePublicContent(); return NextResponse.json({ item }, { status: 201 }); } catch (error) { return cmsError(error); } }
