import type { ReactNode } from "react";

// หัวหน้าที่ใช้ร่วมกันทุกหน้าของผู้ดูแลระบบ จะได้มีระยะห่างและขนาดตัวอักษรเหมือนกัน
export function SuperAdminPageHeader({
  actions,
  description,
  title,
}: {
  // ปุ่มด้านขวาของหัวเรื่อง เช่นปุ่มสร้างรายการใหม่ ไม่ส่งมาก็ไม่แสดงอะไร
  actions?: ReactNode;
  description: string;
  title: string;
}) {
  return <header className="flex flex-wrap items-start justify-between gap-4">
    <div>
      <h1 className="text-2xl font-bold tracking-[-.02em] text-[#292a30]">{title}</h1>
      <p className="mt-1 text-sm text-[#62646c]">{description}</p>
    </div>
    {actions}
  </header>;
}
