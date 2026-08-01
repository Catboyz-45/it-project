import { NextRequest, NextResponse } from "next/server";
import { cmsError, cmsSession, validMutation } from "@/server/cms/http";
import { completeUpload } from "@/server/media/service";
import { audit } from "@/server/auth/audit";
import { requestContext } from "@/server/security/request";

export const maxDuration = 60;
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await cmsSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!validMutation(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  try { const mediaId = await completeUpload((await params).id, session.adminId); await audit({ actorId: session.adminId, action: "MEDIA_UPLOAD_COMPLETED", targetType: "Media", targetId: mediaId, result: "SUCCESS", ...requestContext(request) }); return NextResponse.json({ mediaId }); }
  catch (error) { return cmsError(error); }
}
