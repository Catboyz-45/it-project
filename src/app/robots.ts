/**
 * หน้าที่ของไฟล์นี้: กำหนดกฎให้เครื่องมือค้นหาเข้าถึงหน้าสาธารณะ และห้ามเก็บหน้าผู้ดูแลหรือ API
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.yuyenengineering.co.th";

/** สร้างส่วนหน้าจอ robots; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin/", "/login", "/verify-2fa", "/verify-recovery", "/setup-2fa", "/recovery-codes", "/change-password", "/session-expired", "/menu"] }],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
