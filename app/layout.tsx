import type { Metadata } from "next";
import { Anuphan } from "next/font/google";
import "@/app/globals.css";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { platformProfile } from "@/lib/platform-profile";

// ฟอนต์หลักของทั้งแอป: Anuphan อ่านภาษาไทยได้จริง (Arial/Tahoma เดิมไม่มีตัวไทย
// จึงตกไปที่ฟอนต์ระบบ Tahoma แบบเดิมเสมอ) ผูกเป็น CSS variable แล้วอ้างจาก
// --font-sans / --font-display ใน globals.css เพื่อให้สลับฟอนต์จากจุดเดียว
const anuphan = Anuphan({
  display: "swap",
  subsets: ["thai", "latin"],
  variable: "--font-anuphan",
});

// ค่าที่ Next เอาไปใส่ใน <head> ของทุกหน้า ตั้งไว้ที่เดียวแล้วใช้ทั้งแอป
export const metadata: Metadata = {
  title: `${platformProfile.name} | แพลตฟอร์มบริหารหอพัก`,
  description: "จัดการหลายหอพัก ห้อง ผู้เช่า มิเตอร์ บิล แจ้งซ่อม และพัสดุจากพื้นที่ทำงานเดียว",
  manifest: "/manifest.webmanifest",
  icons: {
    // ไอคอนหลายขนาด เบราว์เซอร์แต่ละตัวเลือกใช้ไม่เหมือนกัน
    icon: [
      { url: "/brand/nestly-favicon-v3-16.png", sizes: "16x16", type: "image/png" },
      { url: "/brand/nestly-favicon-v3-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/nestly-favicon-v3-64.png", sizes: "64x64", type: "image/png" },
      { url: "/brand/nestly-favicon-v3.svg", sizes: "any", type: "image/svg+xml" },
    ],
    apple: [{ url: "/brand/nestly-favicon-v3-180.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/brand/nestly-favicon-v3-32.png",
  },
};

// layout นอกสุดของทุกหน้า ครอบ ToastProvider ไว้ตรงนี้ ทุกหน้าจะได้เรียกแจ้งเตือนได้
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // lang="th" บอกโปรแกรมอ่านหน้าจอให้ออกเสียงภาษาไทย และช่วยเรื่องการตัดคำของเบราว์เซอร์
  return (
    <html className={anuphan.variable} lang="th">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
