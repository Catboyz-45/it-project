import { NextRequest, NextResponse } from "next/server";
import { ContentService } from "@/server/cms/content.service";
import { cmsError, cmsSession, validMutation } from "@/server/cms/http";
import { contentKindSchema } from "@/server/cms/schemas";
import { requestContext } from "@/server/security/request";
import { invalidatePublicContent } from "@/server/services/public-cache";

const service = new ContentService();
export async function GET(_request: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const session = await cmsSession(); if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try { const values = await params; const record = await service.get(contentKindSchema.parse(values.kind), values.id); return record ? NextResponse.json({ record }, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 }); } catch (error) { return cmsError(error); }
}
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const session = await cmsSession(); if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!validMutation(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  try { const values = await params; const kind = contentKindSchema.parse(values.kind); const record = await service.update(kind, values.id, await request.json(), { id: session.adminId, role: session.admin.role }, requestContext(request), request.headers.get("if-unmodified-since")); invalidatePublicContent(kind); return NextResponse.json({ record }); } catch (error) { return cmsError(error); }
}
