import { NextRequest, NextResponse } from "next/server";
import { placeholderLabels } from "@/lib/documents/placeholders";
import { getDocumentPreviewData } from "@/lib/documents/preview-data";
import { completeDocumentData } from "@/lib/documents/service";
import { formatPlaceholderValue } from "@/lib/documents/templates";
import { documentKinds, type DocumentKind } from "@/lib/documents/types";
import { ApiError, apiErrorResponse } from "@/lib/server/api";
import { requireRequestProperty } from "@/lib/server/auth";
import { assertApiRateLimit } from "@/lib/server/api-rate-limit";

export const runtime = "nodejs";

const sourceLabels: Record<DocumentKind, string> = { contract: "สัญญา", invoice: "บิล", receipt: "ใบเสร็จ" };

// ค่าจริงของทุกช่องจากเอกสารล่าสุดของหอ จัดรูปแบบแบบเดียวกับใน PDF แล้ว
// ตัวแก้ไขใช้สลับดูว่าเอกสารจะออกมาหน้าตาแบบไหนโดยไม่ต้องสร้าง PDF
export async function GET(request: NextRequest) {
  try {
    // นับแยกถังกับการสร้าง PDF ตัวอย่าง เปิดหน้าแก้ไขบ่อย ๆ จะได้ไม่ไปกินโควตาของ PDF
    await assertApiRateLimit(request, "document", "preview-data");
    // อ่านอย่างเดียว หอที่อยู่ในโหมดอ่านอย่างเดียวก็ยังดูได้
    const { propertyId } = await requireRequestProperty(request, { requireWriteAccess: false });
    const kind = request.nextUrl.searchParams.get("kind");
    if (!documentKinds.includes(kind as DocumentKind)) throw new ApiError(400, "ประเภทเอกสารไม่ถูกต้อง");
    const documentKind = kind as DocumentKind;
    const data = await completeDocumentData(propertyId, documentKind, await getDocumentPreviewData(propertyId, documentKind)) as Record<string, string | number | undefined>;
    const values = Object.fromEntries(Object.keys(placeholderLabels[documentKind]).map((key) => {
      const value = data[key];
      return [key, value === undefined || value === "" ? "" : String(formatPlaceholderValue(key, value))];
    }));
    return NextResponse.json(
      { label: `${sourceLabels[documentKind]} ${data.reference_id} · ห้อง ${data.room_number}`, values },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
