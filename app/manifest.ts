import type { MetadataRoute } from "next";
import { platformProfile } from "@/lib/platform-profile";

// ไฟล์ manifest ของ PWA ทำให้ติดตั้งลงหน้าจอหลักของมือถือได้
// Next สร้างเป็น /manifest.webmanifest ให้เองจากฟังก์ชันนี้
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: platformProfile.name,
    short_name: platformProfile.name,
    description: platformProfile.description,
    // เปิดจากไอคอนแล้วเริ่มที่หน้าเข้าสู่ระบบ ส่วน standalone คือไม่มีแถบที่อยู่ของเบราว์เซอร์
    start_url: "/login",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#5865f2",
    icons: [
      {
        src: "/brand/nestly-favicon-v3-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/nestly-favicon-v3-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
