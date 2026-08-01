import { NextRequest, NextResponse } from "next/server";
import { ContentService } from "@/server/cms/content.service";
import { cmsError, cmsSession, validMutation } from "@/server/cms/http";
import { contentKindSchema } from "@/server/cms/schemas";
import { requestContext } from "@/server/security/request";
import { invalidatePublicContent } from "@/server/services/public-cache";

const service = new ContentService();
export async function GET(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const session = await cmsSession(); if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try { const kind = contentKindSchema.parse((await params).kind); return NextResponse.json(await service.list(kind, Object.fromEntries(request.nextUrl.searchParams))); } catch (error) { return cmsError(error); }
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const session = await cmsSession(); if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!validMutation(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  try { const kind = contentKindSchema.parse((await params).kind); const record = await service.create(kind, await request.json(), { id: session.adminId, role: session.admin.role }, requestContext(request)); invalidatePublicContent(kind); return NextResponse.json({ record }, { status: 201 }); } catch (error) { return cmsError(error); }
}
