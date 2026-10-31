// ดึงข้อมูลตารางหน้าแรกให้ Server Component ของแต่ละหน้าซูเปอร์แอดมิน
// เรียกฟังก์ชันตัวเดียวกับที่ API เรียก รูปของข้อมูลจึงตรงกับที่หน้าจอคาดไว้
//
// แปลงผ่าน JSON เพราะปกติข้อมูลชุดนี้เดินทางผ่าน API วันที่กับ Decimal
// จึงถึงหน้าจอเป็นสตริง ส่งตรงจากเซิร์ฟเวอร์จะยังเป็น Date กับ Decimal อยู่
import { listSaasPlansPage } from "@/lib/server/saas";
import { toClientData } from "@/lib/server/client-data";
import {
  listSuperAdminAuditLogs,
  listSuperAdminProperties,
  listSuperAdminUsers,
} from "@/lib/server/super-admin-lists";

const pagination = { page: 1, pageSize: 20 };
const serialize = <T,>(value: T): T => toClientData<T>(value);

export async function initialAccountsTable() {
  const result = await listSuperAdminUsers(pagination, {});
  return { pageInfo: result.pageInfo, rows: serialize(result.data) };
}

export async function initialPropertiesTable() {
  const result = await listSuperAdminProperties(pagination, { activeOnly: false });
  return { pageInfo: result.pageInfo, rows: serialize(result.data) };
}

export async function initialPlansTable() {
  // true = เอาแพ็กเกจที่ปิดขายแล้วมาด้วย ตรงกับที่หน้าจอขอเมื่อไม่ได้ส่ง activeOnly
  const result = await listSaasPlansPage(true, pagination);
  return { pageInfo: result.pageInfo, rows: serialize(result.data) };
}

export async function initialAuditLogsTable() {
  const result = await listSuperAdminAuditLogs(pagination, {});
  return { pageInfo: result.pageInfo, rows: serialize(result.data) };
}
