
import { redirect } from "next/navigation";
import { SuperAdminNavigation } from "@/components/admin/SuperAdminNavigation";
import { SuperAdminChatWidget } from "@/components/admin/SuperAdminChatWidget";
import { PlatformBrand } from "@/components/ui/PlatformBrand";
import { SidebarAccountMenu } from "@/components/ui/SidebarAccountMenu";
import { requirePageAuth } from "@/lib/server/auth";

// โครงหน้าของทุกหน้าใต้ /super-admin มีแถบข้างกับพื้นที่เนื้อหา
export default async function SuperAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // ตรวจบทบาทที่ layout ที่เดียว ทุกหน้าลูกจึงได้รับการป้องกันโดยอัตโนมัติ
  const auth = await requirePageAuth();
  // ไม่ใช่ซูเปอร์แอดมินก็เด้งไปหน้าเจ้าของหอ ไม่ต้องบอกว่าที่นี่มีอะไร
  if (auth.role !== "SUPER_ADMIN") redirect("/admin");

  return <main className="shell super-admin-shell text-[#292a30]">
    <aside className="sidebar super-admin-sidebar">
      <div className="brand mb-5">
        <PlatformBrand className="[&_small]:text-[#62646c] [&_strong]:text-base" context="Control" imageClassName="size-11" showTagline />
      </div>
      {/* เมนูเป็น Client Component เพราะต้องรู้ว่าตอนนี้อยู่หน้าไหนเพื่อไฮไลต์ */}
      <SuperAdminNavigation />
      <SidebarAccountMenu displayName={auth.displayName} email={auth.email} role="SUPER_ADMIN" />
    </aside>
    <section className="workspace super-admin-workspace">
      <div className="super-admin-content mx-auto max-w-[1500px] space-y-6 px-6 py-7">
        {children}
      </div>
    </section>
    <SuperAdminChatWidget />
  </main>;
}
