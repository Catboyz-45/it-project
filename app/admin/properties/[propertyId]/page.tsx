
import { PropertyWorkspaceRoute } from "@/components/dorm/PropertyWorkspaceRoute";

// เข้าหอโดยไม่ระบุหน้าย่อย ให้ตกที่ภาพรวมเป็นค่าเริ่มต้น
export default async function PropertyWorkspacePage({ params }: { params: Promise<{ propertyId: string }> }) {
  // Next 16 ส่ง params มาเป็น Promise ต้อง await ก่อนใช้
  const { propertyId } = await params;
  return <PropertyWorkspaceRoute activePage="overview" propertyId={propertyId} />;
}
