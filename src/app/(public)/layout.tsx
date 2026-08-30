/**
 * หน้าที่ของไฟล์นี้: โครงหน้าร่วมของเส้นทางย่อยในโฟลเดอร์นี้ ใช้ครอบเนื้อหาและกำหนดส่วนที่แสดงซ้ำโดยไม่ต้องเขียนใหม่ทุกหน้า
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { PublicShell } from "@/components/site-shell";
import { LocalBusinessStructuredData } from "@/components/structured-data";
import { PublicContentService } from "@/server/services/public-content.service";

export const dynamic = "force-dynamic";

/** สร้างส่วนหน้าจอ PublicLayout; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const company = await new PublicContentService().getCompany();
  return <><LocalBusinessStructuredData company={company} /><PublicShell company={company}>{children}</PublicShell></>;
}
