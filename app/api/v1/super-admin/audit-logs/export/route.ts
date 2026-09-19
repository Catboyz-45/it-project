import { NextRequest } from "next/server"; import { superAdminExportResponse } from "@/lib/server/super-admin-export-response";
// ส่งออก audit log เป็น CSV จำกัดจำนวนแถวเพราะสะสมเร็วมาก
export async function GET(request: NextRequest) { return superAdminExportResponse(request, "audit-logs"); }
