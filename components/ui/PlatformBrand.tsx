/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Platform Brand” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import Image from "next/image";
import { platformProfile } from "@/lib/platform-profile";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Platform Brand Props” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type PlatformBrandProps = {
  className?: string;
  context?: string;
  imageClassName?: string;
  showTagline?: boolean;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Platform Brand” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { className = "", context, imageClassName = "size-11", showT: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function PlatformBrand({
  className = "",
  context,
  imageClassName = "size-11",
  showTagline = false,
}: PlatformBrandProps) {
  return (
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>
      <Image
        alt=""
        aria-hidden="true"
        className={`shrink-0 object-contain ${imageClassName}`}
        height={56}
        src={platformProfile.logoPath}
        width={56}
      />
      <div className="min-w-0">
        <strong className="block truncate font-black">
          {platformProfile.name}{context ? ` ${context}` : ""}
        </strong>
        {showTagline ? <small className="block truncate">{platformProfile.tagline}</small> : null}
      </div>
    </div>
  );
}
