
import { notFound, redirect } from "next/navigation";
import { DocumentTemplateEditorRoute } from "@/components/dorm/DocumentTemplateEditorRoute";
import { documentKinds, type DocumentKind } from "@/lib/documents/types";
import { requirePageAuth } from "@/lib/server/auth";
import { getPropertySubscriptionAccess } from "@/lib/server/subscription-guard";
import { ownerPagePath } from "@/lib/navigation-routes";

// หน้าแก้แม่แบบเอกสาร ตรวจสิทธิ์ครบทุกชั้นก่อน แล้วค่อยส่งต่อให้ตัวแก้ไข
export default async function DocumentEditorPage({ params, searchParams }: Readonly<{ params: Promise<{ kind: string }>; searchParams: Promise<{ propertyId?: string }> }>) {
  const auth = await requirePageAuth();
  const { kind } = await params;
  // รับเฉพาะชนิดที่ระบบรู้จัก ใช้รายชื่อที่อนุญาตชุดเดียวกับ API ไม่ใช่ไล่กันของที่ไม่อนุญาต
  if (!documentKinds.includes(kind as DocumentKind)) notFound();
  const { propertyId } = await searchParams;
  if (!propertyId) redirect(auth.role === "SUPER_ADMIN" ? "/super-admin" : "/admin");
  // ไม่ใช่หอของตัวเองตอบ 404 ไม่ใช่ 403 เพื่อไม่ให้รู้ว่าหอรหัสนี้มีอยู่จริง
  if (auth.role !== "SUPER_ADMIN" && !auth.propertyIds.includes(propertyId)) notFound();
  const subscriptionAccess = await getPropertySubscriptionAccess(propertyId);
  // หมดอายุสมาชิกแล้วให้ดูได้อย่างเดียว จึงไม่ต้องเปิดหน้าแก้ไข
  if (subscriptionAccess.isReadOnly) redirect(ownerPagePath(propertyId, "settings"));
  return <DocumentTemplateEditorRoute kind={kind as DocumentKind} propertyId={propertyId} />;
}
