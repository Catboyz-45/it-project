import Image from "next/image";
import { platformProfile } from "@/lib/platform-profile";

/**
 * โลโก้และชื่อแพลตฟอร์ม ใช้ซ้ำทุกที่ที่ต้องแสดงแบรนด์
 *
 * ชื่อกับโลโก้ไม่ได้รับมาทาง props แต่ดึงจาก platformProfile ที่เดียว
 * เวลาเปลี่ยนชื่อแบรนด์หรือเปลี่ยนรูปจึงแก้ไฟล์เดียวแล้วเปลี่ยนทั้งระบบ
 */
type PlatformBrandProps = {
  // คลาสเพิ่มเติมของกล่องนอกสุด เผื่อแต่ละที่ต้องการระยะหรือสีต่างกัน
  className?: string;
  // ข้อความต่อท้ายชื่อ เช่น "Tenant" หรือ "Control" เพื่อบอกว่าอยู่ส่วนไหนของระบบ
  context?: string;
  // ขนาดโลโก้ ปรับได้เพราะบางที่ใช้เล็กกว่าเมนูหลัก
  imageClassName?: string;
  // จะแสดงคำโปรยใต้ชื่อหรือไม่ บางที่มีพื้นที่พอ บางที่ไม่มี
  showTagline?: boolean;
};

export function PlatformBrand({
  className = "",
  context,
  imageClassName = "size-11",
  showTagline = false,
}: PlatformBrandProps) {
  return (
    // min-w-0 จำเป็นสำหรับให้ truncate ข้างในทำงาน ถ้าไม่ใส่ กล่องจะดันกว้างตามข้อความ
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>
      <Image
        // alt ว่างคู่กับ aria-hidden เพราะชื่อแบรนด์เป็นข้อความอยู่ข้าง ๆ แล้ว
        // ถ้าใส่ alt ด้วย โปรแกรมอ่านหน้าจอจะอ่านชื่อซ้ำสองรอบ
        alt=""
        aria-hidden="true"
        // shrink-0 กันโลโก้ถูกบีบแบนเมื่อข้อความยาว
        className={`shrink-0 object-contain ${imageClassName}`}
        // ขนาดจริงของไฟล์ ใช้บอก Next ให้จองพื้นที่ล่วงหน้า กันหน้ากระตุกตอนรูปโหลดเสร็จ
        height={56}
        src={platformProfile.logoPath}
        width={56}
      />
      <div className="min-w-0">
        <strong className="block truncate font-black">
          {/* ต่อ context ท้ายชื่อเมื่อมีการส่งมา เช่น "Nestly Tenant" */}
          {platformProfile.name}{context ? ` ${context}` : ""}
        </strong>
        {/* คำโปรยเป็นของเสริม ที่ไหนไม่ต้องการก็ไม่ render เลย */}
        {showTagline ? <small className="block truncate">{platformProfile.tagline}</small> : null}
      </div>
    </div>
  );
}
