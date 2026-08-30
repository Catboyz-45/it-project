/**
 * หน้าที่ของไฟล์นี้: โครงหน้าร่วมของเส้นทางย่อยในโฟลเดอร์นี้ ใช้ครอบเนื้อหาและกำหนดส่วนที่แสดงซ้ำโดยไม่ต้องเขียนใหม่ทุกหน้า
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { UIProvider } from "@/components/ui-feedback";

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.yuyenengineering.co.th"),
  title: { default: "อยู่เย็นเป็นสุข วิศวกรรม", template: "%s | อยู่เย็นเป็นสุข วิศวกรรม" },
  description: "บริการจำหน่าย ติดตั้ง ล้าง และซ่อมบำรุงระบบปรับอากาศ พร้อมงานระบบ M&E โดยทีมช่างมืออาชีพ",
  applicationName: "อยู่เย็นเป็นสุข วิศวกรรม",
  authors: [{ name: "บริษัท อยู่เย็นเป็นสุข วิศวกรรม จำกัด" }],
  creator: "บริษัท อยู่เย็นเป็นสุข วิศวกรรม จำกัด",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "th_TH",
    siteName: "อยู่เย็นเป็นสุข วิศวกรรม",
    title: "อยู่เย็นเป็นสุข วิศวกรรม",
    description: "บริการระบบปรับอากาศและงานระบบ M&E สำหรับบ้าน สำนักงาน และอาคารพาณิชย์",
    url: "/",
  },
  twitter: { card: "summary_large_image", title: "อยู่เย็นเป็นสุข วิศวกรรม" },
  robots: { index: true, follow: true },
};

/** สร้างส่วนหน้าจอ RootLayout; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className={notoSansThai.variable}><UIProvider>{children}</UIProvider></body>
    </html>
  );
}
