import Image from "next/image";
import { platformProfile } from "@/lib/platform-profile";

type PlatformBrandProps = {
  className?: string;
  // ต่อท้ายชื่อ เช่น "Tenant" หรือ "Control" บอกว่าอยู่ส่วนไหนของระบบ
  context?: string;
  // บางที่ใช้โลโก้เล็กกว่าเมนูหลัก
  imageClassName?: string;
  showTagline?: boolean;
};

// โลโก้กับชื่อแบรนด์ ดึงจาก platformProfile ที่เดียว เปลี่ยนทีเดียวเปลี่ยนทั้งระบบ
export function PlatformBrand({
  className = "",
  context,
  imageClassName = "size-11",
  showTagline = false,
}: Readonly<PlatformBrandProps>) {
  return (
    // min-w-0 จำเป็นสำหรับให้ truncate ข้างในทำงาน
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>
      <Image
        // alt ว่าง + aria-hidden เพราะชื่อแบรนด์เป็นข้อความอยู่ข้าง ๆ แล้ว ไม่งั้นอ่านซ้ำสองรอบ
        alt=""
        aria-hidden="true"
        // shrink-0 กันโลโก้ถูกบีบแบนเมื่อข้อความยาว
        className={`shrink-0 object-contain ${imageClassName}`}
        // ขนาดจริงของไฟล์ ให้ Next จองพื้นที่ล่วงหน้า กันหน้ากระตุกตอนรูปโหลดเสร็จ
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
