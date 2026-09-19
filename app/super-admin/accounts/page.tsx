
import { SuperAdminForms } from "@/components/admin/SuperAdminForms";
import { SuperAdminPageHeader } from "@/components/admin/SuperAdminPageHeader";
import { SuperAdminResourceTables } from "@/components/admin/SuperAdminResourceTables";
import { initialAccountsTable } from "@/lib/server/super-admin-initial";

// หน้าจัดการบัญชีเจ้าของหอ ปุ่มสร้างบัญชีส่งเข้าไปเป็น prop เพื่อให้ไปวางในหัวตารางได้
export default async function SuperAdminAccountsPage() {
  // layout ตรวจบทบาทไปแล้ว ตรงนี้ดึงตารางหน้าแรกให้มาพร้อม HTML
  const initialTable = await initialAccountsTable();
  return <>
    <SuperAdminPageHeader
      description="สร้าง อนุมัติ หรือปฏิเสธบัญชีเจ้าของหอ และกำหนดหอพักที่รับผิดชอบ"
      title="บัญชีเจ้าของหอ"
    />
    <SuperAdminResourceTables
      initialTables={{ "accounts": initialTable }}
      accountAction={<SuperAdminForms sections={["account"]} />}
      resources={["accounts"]}
    />
  </>;
}
