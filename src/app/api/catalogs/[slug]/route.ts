import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerEnv } from "@/server/config/env";
import { db } from "@/server/db";
import { storage } from "@/server/storage/s3";

const slugSchema = z.string().min(2).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const parsed = slugSchema.safeParse((await params).slug); if (!parsed.success) return NextResponse.json({ error: "ไม่พบแคตตาล็อก" }, { status: 404 });
  const product = await db.product.findFirst({ where: { slug: parsed.data, status: "PUBLISHED", deletedAt: null, publishedAt: { lte: new Date() }, catalogMedia: { status: "READY", deletedAt: null, kind: "PDF" } }, select: { slug: true, catalogMedia: { select: { objectKey: true, originalName: true } } } });
  if (!product?.catalogMedia) return NextResponse.json({ error: "ไม่พบแคตตาล็อก" }, { status: 404 });
  try {
    const url = await storage().signGet(product.catalogMedia.objectKey, getServerEnv().MEDIA_SIGNED_URL_SECONDS, product.catalogMedia.originalName ?? `${product.slug}-catalog.pdf`);
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" } });
  } catch { return NextResponse.json({ error: "ไม่สามารถดาวน์โหลดแคตตาล็อกได้" }, { status: 503 }); }
}
