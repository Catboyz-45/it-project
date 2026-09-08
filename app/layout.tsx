/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโครงหน้าและส่วนที่ใช้ร่วมกันของเส้นทาง /layout.tsx ใน Next.js App Router
 * การทำงาน: ประกอบข้อมูลจากฝั่งเซิร์ฟเวอร์กับคอมโพเนนต์ที่นำมาใช้ซ้ำ; การตรวจสิทธิ์สำคัญต้องเกิดบนเซิร์ฟเวอร์ก่อนแสดงข้อมูล
 */

import type { Metadata } from "next";
import "@/app/globals.css";
import { ClickSpark } from "@/components/ui/ClickSpark";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { platformProfile } from "@/lib/platform-profile";

export const metadata: Metadata = {
  title: `${platformProfile.name} | แพลตฟอร์มบริหารหอพัก`,
  description: "จัดการหลายหอพัก ห้อง ผู้เช่า มิเตอร์ บิล แจ้งซ่อม และพัสดุจากพื้นที่ทำงานเดียว",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/brand/nestly-tab-icon-v2.png?v=20260822", sizes: "64x64", type: "image/png" },
      { url: "/brand/nestly-icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/nestly-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/nestly-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/brand/nestly-tab-icon-v2.png?v=20260822",
  },
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Root Layout” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { children }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>
        <ClickSpark sparkColor="#ec48bd" sparkCount={8} sparkRadius={18} sparkSize={10}>
          <ToastProvider>{children}</ToastProvider>
        </ClickSpark>
      </body>
    </html>
  );
}
