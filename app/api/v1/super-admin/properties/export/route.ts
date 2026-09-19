import { NextRequest } from "next/server"; import { superAdminExportResponse } from "@/lib/server/super-admin-export-response";
// ส่งออกรายการหอพักเป็น CSV
export async function GET(request: NextRequest) { return superAdminExportResponse(request, "properties"); }
