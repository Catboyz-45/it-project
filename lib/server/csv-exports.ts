/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “csv exports” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import { createCsv } from "@/lib/csv";
import { ApiError } from "@/lib/server/api";
import { listInvoices } from "@/lib/server/invoices";
import { listPropertyTenants } from "@/lib/server/property-management";

const PAGE_SIZE = 100;
const MAX_EXPORT_ROWS = 10_000;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Invoice Status” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type InvoiceStatus = "DRAFT" | "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “collect Pages” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - load: ค่า “load” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
async function collectPages<T>(load: (page: number) => Promise<{ data: T[]; pageInfo: { hasNextPage: boolean } }>) {
  const rows: T[] = [];
  for (let page = 1; ; page += 1) {
    const result = await load(page);
    rows.push(...result.data);
    if (!result.pageInfo.hasNextPage) return rows;
    if (rows.length >= MAX_EXPORT_ROWS) {
      throw new ApiError(413, `ส่งออกได้สูงสุด ${MAX_EXPORT_ROWS.toLocaleString("th-TH")} รายการ กรุณาเพิ่มตัวกรอง`);
    }
  }
}

const invoiceStatusText: Record<InvoiceStatus, string> = {
  DRAFT: "ฉบับร่าง",
  PENDING: "รอชำระ",
  PAID: "ชำระแล้ว",
  OVERDUE: "ค้างชำระ",
  CANCELLED: "ยกเลิก",
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “export Invoices Csv” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - filters: ค่า “filters” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function exportInvoicesCsv(propertyId: string, filters: {
  billingMonth?: string;
  query?: string;
  status?: InvoiceStatus;
}) {
  const invoices = await collectPages((page) => listInvoices(
    propertyId,
    { page, pageSize: PAGE_SIZE },
    filters.billingMonth,
    { query: filters.query, status: filters.status },
  ));
  return createCsv([
    ["เลขที่บิล", "รอบบิล", "ห้อง", "ผู้เช่า", "ค่าเช่า", "ค่าน้ำ", "ค่าไฟ", "ค่าบริการ/อื่น ๆ", "ค่าปรับ", "ยอดรวม", "สถานะ", "วันออกบิล", "วันครบกำหนด", "วันที่ชำระ"],
    ...invoices.map((invoice) => {
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “amount” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - type: ค่า “type” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
    const amount = (type: string) => Number(invoice.items.find((item) => item.type === type)?.amount ?? 0);
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “other” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - sum: ค่า “sum” ที่จำเป็นต่อการทำงานของก้อนนี้
     * - item: ค่า “item” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
    const other = invoice.items
        .filter((item) => !["RENT", "WATER", "ELECTRICITY", "LATE_FEE"].includes(item.type))
        .reduce((sum, item) => sum + Number(item.amount), 0);
      return [
        invoice.invoiceNumber,
        invoice.billingMonth.toISOString().slice(0, 7),
        invoice.room.number,
        invoice.room.occupancies[0]?.tenantProfile.user.displayName ?? "",
        amount("RENT"),
        amount("WATER"),
        amount("ELECTRICITY"),
        other,
        Number(invoice.lateFee),
        Number(invoice.total),
        invoiceStatusText[invoice.status],
        invoice.issuedAt?.toISOString().slice(0, 10) ?? "",
        invoice.dueDate.toISOString().slice(0, 10),
        invoice.paidAt?.toISOString().slice(0, 10) ?? "",
      ];
    }),
  ]);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “export Tenants Csv” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - query: ค่า “query” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function exportTenantsCsv(propertyId: string, query?: string) {
  const tenants = await collectPages((page) => listPropertyTenants(
    propertyId,
    { page, pageSize: PAGE_SIZE },
    query,
  ));
  return createCsv([
    ["ชื่อผู้เช่า", "บทบาท", "ห้อง", "เบอร์โทร", "อีเมล", "วันเริ่มเข้าพัก", "วันสิ้นสุดสัญญา", "เลขที่สัญญา", "สถานะสัญญา", "ค่าเช่ารายเดือน", "เงินประกัน", "ที่อยู่", "ผู้ติดต่อฉุกเฉิน", "เบอร์ฉุกเฉิน", "ประเภทรถ", "ทะเบียนรถ", "จังหวัดทะเบียน"],
    ...tenants.map((tenant) => [
      tenant.name,
      tenant.role === "PRIMARY" ? "ผู้เช่าหลัก" : "ผู้พักร่วม",
      tenant.roomId,
      tenant.phone,
      tenant.email,
      tenant.startDate,
      tenant.contractEnd ?? "",
      tenant.leaseNumber ?? "",
      tenant.leaseStatus ?? "",
      tenant.monthlyRent ?? "",
      tenant.deposit,
      tenant.address,
      tenant.guardianName,
      tenant.guardianPhone,
      tenant.vehicleType,
      tenant.vehiclePlate,
      tenant.vehicleProvince,
    ]),
  ]);
}
