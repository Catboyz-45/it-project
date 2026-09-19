import { NextRequest } from "next/server"; import { superAdminExportResponse } from "@/lib/server/super-admin-export-response";
// ส่งออกรายการบัญชีเจ้าของหอเป็น CSV
export async function GET(request: NextRequest) { return superAdminExportResponse(request, "users"); }
