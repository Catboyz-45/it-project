import { NextRequest, NextResponse } from "next/server";
import { cmsError, cmsSession, validMutation } from "@/server/cms/http";
import { createUpload } from "@/server/media/service";
import { uploadRequestSchema } from "@/server/media/validation";
import { audit } from "@/server/auth/audit";
import { requestContext } from "@/server/security/request";

export async function POST(request: NextRequest) {
  const session = await cmsSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!validMutation(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  try { const result = await createUpload(uploadRequestSchema.parse(await request.json()), session.adminId); await audit({ actorId: session.adminId, action: "MEDIA_UPLOAD_STARTED", targetType: "Media", targetId: result.mediaId, result: "SUCCESS", ...requestContext(request) }); return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return cmsError(error); }
}
