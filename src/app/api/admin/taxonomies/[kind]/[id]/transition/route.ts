import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { TaxonomyService } from "@/server/cms/taxonomy.service";
import { cmsError, cmsSession, validMutation } from "@/server/cms/http";
import { taxonomyKindSchema } from "@/server/cms/schemas";
import { invalidatePublicContent } from "@/server/services/public-cache";
import { requestContext } from "@/server/security/request";
const service = new TaxonomyService(); const schema = z.object({ action: z.enum(["restore", "delete"]) }).strict();
export async function POST(request: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) { const session = await cmsSession(); if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 }); if (!validMutation(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 }); try { const values = await params; const { action } = schema.parse(await request.json()); await service.transition(taxonomyKindSchema.parse(values.kind), values.id, action, { id: session.adminId, role: session.admin.role }, requestContext(request)); invalidatePublicContent(); return NextResponse.json({ success: true }); } catch (error) { return cmsError(error); } }
