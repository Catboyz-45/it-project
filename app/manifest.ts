/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นไฟล์ตั้งค่าหรือจุดเชื่อมระบบ “manifest” ของโปรเจกต์ Nestly
 * การทำงาน: กำหนดวิธีที่เครื่องมือ build, test หรือ runtime ทำงานร่วมกับโค้ดหลัก โดยไม่เก็บข้อมูลผู้ใช้งานจริง
 */

import type { MetadataRoute } from "next";
import { platformProfile } from "@/lib/platform-profile";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “manifest” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืนข้อมูลชนิด MetadataRoute.Manifest ตามสัญญา TypeScript ของฟังก์ชัน
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: platformProfile.name,
    short_name: platformProfile.name,
    description: platformProfile.description,
    start_url: "/login",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#5865f2",
    icons: [
      {
        src: "/brand/nestly-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/nestly-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
