import { SuperAdminForms } from "@/components/admin/SuperAdminForms";
import { SuperAdminPageHeader } from "@/components/admin/SuperAdminPageHeader";
import { SuperAdminResourceTables } from "@/components/admin/SuperAdminResourceTables";
import { initialPropertiesTable } from "@/lib/server/super-admin-initial";
import { parseSuperAdminPropertyStatus } from "@/lib/server/super-admin-lists";

// หน้ารวมหอพักทุกหอบนแพลตฟอร์ม ปุ่มสร้างหอส่งเข้าไปเป็น prop เพื่อให้ไปวางในหัวตารางได้
// ?status=expiring มาจากการ์ด "แพ็กเกจใกล้หมดอายุ" บนแดชบอร์ด เปิดมาแล้วกรองให้เลย
export default async function SuperAdminPropertiesPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ status?: string }>;
}>) {
  const status = parseSuperAdminPropertyStatus((await searchParams).status);
  // layout ตรวจบทบาทไปแล้ว ตรงนี้ดึงตารางหน้าแรกให้มาพร้อม HTML
  const initialTable = await initialPropertiesTable(status);
  return <>
    <SuperAdminPageHeader
      description="สร้างและตรวจสอบพื้นที่หอพักทั้งหมดที่อยู่บนแพลตฟอร์ม"
      title="หอพัก"
    />
    {/* key ตามตัวกรอง กดลิงก์ที่เปลี่ยนแค่ ?status แล้วตารางจะเริ่มใหม่ตามตัวกรองนั้น */}
    <SuperAdminResourceTables
      key={status ?? "all"}
      initialFilters={{ "properties": status ?? "" }}
      initialTables={{ "properties": initialTable }}
      propertyAction={<SuperAdminForms sections={["property"]} />}
      resources={["properties"]}
    />
  </>;
}
