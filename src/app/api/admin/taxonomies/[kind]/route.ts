import { NextRequest, NextResponse } from "next/server";
import { TaxonomyService } from "@/server/cms/taxonomy.service";
import { cmsError, cmsSession, validMutation } from "@/server/cms/http";
import { taxonomyKindSchema } from "@/server/cms/schemas";
import { requestContext } from "@/server/security/request";
import { invalidatePublicContent } from "@/server/services/public-cache";
const service = new TaxonomyService();
export async function GET(_request: NextRequest, { params }: { params: Promise<{ kind: string }> }) { const session = await cmsSession(); if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 }); try { return NextResponse.json({ items: await service.list(taxonomyKindSchema.parse((await params).kind)) }); } catch (error) { return cmsError(error); } }
export async function POST(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) { const session = await cmsSession(); if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 }); if (!validMutation(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 }); try { const item = await service.create(taxonomyKindSchema.parse((await params).kind), await request.json(), { id: session.adminId, role: session.admin.role }, requestContext(request)); invalidatePublicContent(); return NextResponse.json({ item }, { status: 201 }); } catch (error) { return cmsError(error); } }
