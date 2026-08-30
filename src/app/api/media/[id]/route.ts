/**
 * หน้าที่ของไฟล์นี้: API /api/media/[id] รองรับ GET; ตรวจสอบคำขอ เรียกกฎฝั่งเซิร์ฟเวอร์ และส่งผลลัพธ์ JSON โดยไม่เปิดเผยข้อมูลภายใน
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentSession } from "@/server/auth/session";
import { getServerEnv } from "@/server/config/env";
import { db } from "@/server/db";
import { storage } from "@/server/storage/s3";

const querySchema = z.object({ width: z.coerce.number().int().min(1).max(3000).optional(), format: z.enum(["webp", "avif"]).optional(), download: z.enum(["0", "1"]).optional() });
async function publiclyReferenced(id: string) {
  const published = { status: "PUBLISHED" as const, deletedAt: null, publishedAt: { lte: new Date() } };
  const counts = await db.$transaction([
    db.company.count({ where: { logoMediaId: id } }), db.banner.count({ where: { imageId: id, ...published } }), db.service.count({ where: { coverMediaId: id, ...published } }),
    db.product.count({ where: { coverMediaId: id, ...published } }), db.product.count({ where: { catalogMediaId: id, ...published } }), db.productMedia.count({ where: { mediaId: id, product: published } }),
    db.project.count({ where: { coverMediaId: id, ...published } }), db.projectMedia.count({ where: { mediaId: id, project: published } }), db.news.count({ where: { coverMediaId: id, ...published } }),
  ]);
  return counts.reduce((sum, count) => sum + count, 0) > 0;
}

/** จุดเริ่มของคำขอ HTTP GET: อ่านข้อมูลโดยไม่แก้ไขข้อมูล และคืนสถานะที่เหมาะสมให้ผู้เรียก */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams)); if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  const media = await db.media.findFirst({ where: { id: (await params).id, status: "READY", deletedAt: null }, include: { variants: true } });
  if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const session = await currentSession(); const authorizedAdmin = Boolean(session?.twoFactorAt && session.admin.isActive && !session.admin.deletedAt);
  if (!authorizedAdmin && !(await publiclyReferenced(media.id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let objectKey = media.objectKey;
  if (media.kind === "IMAGE" && media.variants.length) {
    const format = (parsed.data.format ?? "webp").toUpperCase(); const width = parsed.data.width ?? 1280;
    const candidates = media.variants.filter(item => item.format === format).sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
    objectKey = (candidates.find(item => (item.width ?? 0) >= width) ?? candidates.at(-1) ?? media).objectKey;
  }
  try {
    const url = await storage().signGet(objectKey, getServerEnv().MEDIA_SIGNED_URL_SECONDS, parsed.data.download === "1" ? (media.originalName ?? "download") : undefined);
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" } });
  } catch { return NextResponse.json({ error: "Media unavailable" }, { status: 503 }); }
}
