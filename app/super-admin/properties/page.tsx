
import { SuperAdminForms } from "@/components/admin/SuperAdminForms";
import { SuperAdminPageHeader } from "@/components/admin/SuperAdminPageHeader";
import { SuperAdminResourceTables } from "@/components/admin/SuperAdminResourceTables";

// หน้ารวมหอพักทุกหอบนแพลตฟอร์ม ปุ่มสร้างหอส่งเข้าไปเป็น prop เพื่อให้ไปวางในหัวตารางได้
export default function SuperAdminPropertiesPage() {
  return <>
    <SuperAdminPageHeader
      description="สร้างและตรวจสอบพื้นที่หอพักทั้งหมดที่อยู่บนแพลตฟอร์ม"
      title="หอพัก"
    />
    <SuperAdminResourceTables
      propertyAction={<SuperAdminForms sections={["property"]} />}
      resources={["properties"]}
    />
  </>;
}
