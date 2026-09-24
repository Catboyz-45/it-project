import type { ReactNode } from "react";

// กรอบของแต่ละส่วนในหน้า ใช้โครงเดียวกับ Section ของ Cal
// พื้นเทาอ่อนห่อไว้ หัวข้อมีไอคอนกับคำอธิบาย แล้วเนื้อหาอยู่ข้างใน
// ทั้งสามโรลใช้ตัวนี้ หน้าหลักจึงอ่านเป็นระบบเดียวกัน
export function AppSection({
  // ตัวเลขหรือข้อความสั้น ๆ มุมขวาของหัวข้อ เช่นจำนวนรายการที่รอดำเนินการ
  aside,
  children,
  // ใช้ใส่คลาสของ grid เช่นการกินพื้นที่กี่คอลัมน์ เมื่อส่วนนี้อยู่ในตารางของหน้า
  className,
  description,
  icon,
  title,
}: Readonly<{
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: string;
  icon: ReactNode;
  title: string;
}>) {
  return (
    <section className={`app-section ${className ?? ""}`.trim()}>
      <header className="app-section-head">
        <div>
          <span>{icon}</span>
          <div className="min-w-0">
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
        </div>
        {aside ? <small>{aside}</small> : null}
      </header>
      {children}
    </section>
  );
}
