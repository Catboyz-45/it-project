
import { SuperAdminForms } from "@/components/admin/SuperAdminForms";
import { SuperAdminPageHeader } from "@/components/admin/SuperAdminPageHeader";
import { SuperAdminResourceTables } from "@/components/admin/SuperAdminResourceTables";
import { initialPropertiesTable } from "@/lib/server/super-admin-initial";

// หน้ารวมหอพักทุกหอบนแพลตฟอร์ม ปุ่มสร้างหอส่งเข้าไปเป็น prop เพื่อให้ไปวางในหัวตารางได้
export default async function SuperAdminPropertiesPage() {
  // layout ตรวจบทบาทไปแล้ว ตรงนี้ดึงตารางหน้าแรกให้มาพร้อม HTML
  const initialTable = await initialPropertiesTable();
  return <>
    <SuperAdminPageHeader
      description="สร้างและตรวจสอบพื้นที่หอพักทั้งหมดที่อยู่บนแพลตฟอร์ม"
      title="หอพัก"
    />
    <SuperAdminResourceTables
      initialTables={{ "properties": initialTable }}
      propertyAction={<SuperAdminForms sections={["property"]} />}
      resources={["properties"]}
    />
  </>;
}
