import { NextRequest, NextResponse } from "next/server";
import { ContentService } from "@/server/cms/content.service";
import { cmsError, cmsSession, validMutation } from "@/server/cms/http";
import { contentKindSchema, transitionSchema } from "@/server/cms/schemas";
import { requestContext } from "@/server/security/request";
import { invalidatePublicContent } from "@/server/services/public-cache";

const service = new ContentService();
export async function POST(request: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const session = await cmsSession(); if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!validMutation(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  try { const values = await params; const kind = contentKindSchema.parse(values.kind); const { action } = transitionSchema.parse(await request.json()); const result = await service.transition(kind, values.id, action, { id: session.adminId, role: session.admin.role }, requestContext(request)); invalidatePublicContent(kind); return NextResponse.json(result); } catch (error) { return cmsError(error); }
}
