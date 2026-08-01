import { NextRequest, NextResponse } from "next/server";
import { TaxonomyService } from "@/server/cms/taxonomy.service";
import { cmsError, cmsSession, validMutation } from "@/server/cms/http";
import { taxonomyKindSchema } from "@/server/cms/schemas";
import { invalidatePublicContent } from "@/server/services/public-cache";
import { requestContext } from "@/server/security/request";
const service = new TaxonomyService();
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) { const session = await cmsSession(); if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 }); if (!validMutation(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 }); try { const values = await params; const item = await service.update(taxonomyKindSchema.parse(values.kind), values.id, await request.json(), { id: session.adminId, role: session.admin.role }, requestContext(request)); invalidatePublicContent(); return NextResponse.json({ item }); } catch (error) { return cmsError(error); } }
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) { const session = await cmsSession(); if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 }); if (!assertOrigin(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 }); try { const values = await params; await service.remove(taxonomyKindSchema.parse(values.kind), values.id, { id: session.adminId, role: session.admin.role }, requestContext(request)); invalidatePublicContent(); return new NextResponse(null, { status: 204 }); } catch (error) { return cmsError(error); } }
function assertOrigin(request: NextRequest) { try { return new URL(request.headers.get("origin") ?? "").origin === new URL(process.env.APP_URL ?? "http://localhost:3000").origin; } catch { return false; } }
