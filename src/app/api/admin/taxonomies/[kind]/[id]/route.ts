/**
 * หน้าที่ของไฟล์นี้: API /api/admin/taxonomies/[kind]/[id] รองรับ PATCH, DELETE; ตรวจสอบคำขอ เรียกกฎฝั่งเซิร์ฟเวอร์ และส่งผลลัพธ์ JSON โดยไม่เปิดเผยข้อมูลภายใน
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { NextRequest, NextResponse } from "next/server";
import { TaxonomyService } from "@/server/cms/taxonomy.service";
import { cmsError, cmsSession, validMutation } from "@/server/cms/http";
import { taxonomyKindSchema } from "@/server/cms/schemas";
import { invalidatePublicContent } from "@/server/services/public-cache";
import { requestContext } from "@/server/security/request";
const service = new TaxonomyService();
/** จุดเริ่มของคำขอ HTTP PATCH: แก้เฉพาะช่องที่ส่งมา และคืนสถานะที่เหมาะสมให้ผู้เรียก */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) { const session = await cmsSession(); if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 }); if (!validMutation(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 }); try { const values = await params; const item = await service.update(taxonomyKindSchema.parse(values.kind), values.id, await request.json(), { id: session.adminId, role: session.admin.role }, requestContext(request)); invalidatePublicContent(); return NextResponse.json({ item }); } catch (error) { return cmsError(error); } }
/** จุดเริ่มของคำขอ HTTP DELETE: ลบหรือย้ายข้อมูลออกตามกฎ retention และคืนสถานะที่เหมาะสมให้ผู้เรียก */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) { const session = await cmsSession(); if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 }); if (!assertOrigin(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 }); try { const values = await params; await service.remove(taxonomyKindSchema.parse(values.kind), values.id, { id: session.adminId, role: session.admin.role }, requestContext(request)); invalidatePublicContent(); return new NextResponse(null, { status: 204 }); } catch (error) { return cmsError(error); } }
function assertOrigin(request: NextRequest) { try { return new URL(request.headers.get("origin") ?? "").origin === new URL(process.env.APP_URL ?? "http://localhost:3000").origin; } catch { return false; } }
