/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React logo ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { Leaf } from "lucide-react";

/** สร้างส่วนหน้าจอ Logo; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className="brand">
      <span className="brand-mark"><Leaf size={18} aria-hidden="true" /></span>
      <span className="brand-copy">
        <strong style={{ color: inverse ? "white" : undefined }}>อยู่เย็นเป็นสุข</strong>
        <span style={{ color: inverse ? "rgba(255,255,255,.58)" : undefined }}>วิศวกรรม จำกัด</span>
      </span>
    </span>
  );
}
