import type { ReactNode } from "react";
import { NavToggle } from "@/components/ui/NavShell";
import { SuperAdminNotificationBell } from "@/components/admin/SuperAdminNotifications";

// หัวหน้าที่ใช้ร่วมกันทุกหน้าของผู้ดูแลระบบ จะได้มีระยะห่างและขนาดตัวอักษรเหมือนกัน
export function SuperAdminPageHeader({
  actions,
  description,
  title,
}: Readonly<{
  // ปุ่มด้านขวาของหัวเรื่อง เช่นปุ่มสร้างรายการใหม่ ไม่ส่งมาก็ไม่แสดงอะไร
  actions?: ReactNode;
  description: string;
  title: string;
}>) {
  // จัดวางด้วย CSS ใน globals.css มือถือให้กระดิ่งอยู่แถวเดียวกับชื่อหน้า
  return <header className="super-admin-page-header">
    <div className="topbar-heading">
      <NavToggle placement="topbar" />
      <div>
        <h1 className="text-2xl font-bold tracking-[-.02em] text-[#292a30]">{title}</h1>
        <p className="mt-1 text-sm text-[#62646c]">{description}</p>
      </div>
    </div>
    <div className="super-admin-page-header-actions">
      {actions}
      <div className="super-admin-page-bell"><SuperAdminNotificationBell /></div>
    </div>
  </header>;
}
