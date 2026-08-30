/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React loading-label ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { LoaderCircle } from "lucide-react";

/** สร้างส่วนหน้าจอ LoadingLabel; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function LoadingLabel({
  busy,
  children,
  busyText = "กำลังดำเนินการ…",
}: {
  busy: boolean;
  children: React.ReactNode;
  busyText?: string;
}) {
  return busy ? (
    <>
      <LoaderCircle className="spin" size={17} aria-hidden="true" /> {busyText}
    </>
  ) : (
    children
  );
}
