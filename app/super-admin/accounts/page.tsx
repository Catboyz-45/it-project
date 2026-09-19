
import { SuperAdminForms } from "@/components/admin/SuperAdminForms";
import { SuperAdminPageHeader } from "@/components/admin/SuperAdminPageHeader";
import { SuperAdminResourceTables } from "@/components/admin/SuperAdminResourceTables";

// หน้าจัดการบัญชีเจ้าของหอ ปุ่มสร้างบัญชีส่งเข้าไปเป็น prop เพื่อให้ไปวางในหัวตารางได้
export default function SuperAdminAccountsPage() {
  return <>
    <SuperAdminPageHeader
      description="สร้าง อนุมัติ หรือปฏิเสธบัญชีเจ้าของหอ และกำหนดหอพักที่รับผิดชอบ"
      title="บัญชีเจ้าของหอ"
    />
    <SuperAdminResourceTables
      accountAction={<SuperAdminForms sections={["account"]} />}
      resources={["accounts"]}
    />
  </>;
}
