import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { cmsSession } from "@/server/cms/http";

const querySchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(30), kind: z.enum(["IMAGE", "PDF"]).optional() });
export async function GET(request: NextRequest) {
  const session = await cmsSession(); if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams)); if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  const { page, pageSize, kind } = parsed.data; const where = { deletedAt: null, status: "READY" as const, ...(kind ? { kind } : {}) };
  const [items, total, originals, derivatives] = await db.$transaction([
    db.media.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { variants: { orderBy: { width: "asc" } } } }),
    db.media.count({ where }), db.media.aggregate({ where: { deletedAt: null, status: "READY", kind: "PDF" }, _sum: { sizeBytes: true } }),
    db.mediaVariant.aggregate({ where: { media: { deletedAt: null, status: "READY" } }, _sum: { sizeBytes: true } }),
  ]);
  return NextResponse.json({ items: items.map(item => ({ ...item, sizeBytes: Number(item.sizeBytes), variants: item.variants.map(variant => ({ ...variant, sizeBytes: Number(variant.sizeBytes) })) })), total, usageBytes: Number((originals._sum.sizeBytes ?? BigInt(0)) + (derivatives._sum.sizeBytes ?? BigInt(0))) }, { headers: { "Cache-Control": "no-store" } });
}
