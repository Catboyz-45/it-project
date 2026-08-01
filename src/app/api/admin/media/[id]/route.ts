import { NextRequest, NextResponse } from "next/server";
import { cmsError, cmsSession, validMutation } from "@/server/cms/http";
import { trashMedia } from "@/server/media/service";
import { audit } from "@/server/auth/audit";
import { requestContext } from "@/server/security/request";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await cmsSession(); if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!validMutation(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  try { const id = (await params).id; await trashMedia(id); await audit({ actorId: session.adminId, action: "MEDIA_TRASHED", targetType: "Media", targetId: id, result: "SUCCESS", ...requestContext(request) }); return new NextResponse(null, { status: 204 }); } catch (error) { return cmsError(error); }
}
