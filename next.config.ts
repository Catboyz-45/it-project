/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นไฟล์ตั้งค่าหรือจุดเชื่อมระบบ “next.config” ของโปรเจกต์ Nestly
 * การทำงาน: กำหนดวิธีที่เครื่องมือ build, test หรือ runtime ทำงานร่วมกับโค้ดหลัก โดยไม่เก็บข้อมูลผู้ใช้งานจริง
 */

import type { NextConfig } from "next";

const scriptSources = process.env.NODE_ENV === "development"
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

const nextConfig: NextConfig = {
  // The self-hosted Dockerfile copies .next/standalone directly, but Vercel
  // has its own serverless bundling that this mode conflicts with (it fails
  // the build looking for a .next/next-server.js.nft.json that standalone
  // output doesn't produce in the shape Vercel expects). VERCEL is set
  // automatically on every Vercel build, so only opt into standalone when
  // building elsewhere (Docker, or a plain local `npm run build`).
  ...(process.env.VERCEL ? {} : { output: "standalone" }),
  poweredByHeader: false,
  // เซิร์ฟเวอร์ dev ของ Next ยอมรับเฉพาะ origin "localhost" เป็นค่าเริ่มต้น เปิดหน้าเว็บ
  // ผ่าน 127.0.0.1 แล้ว WebSocket ของ HMR จะถูกปฏิเสธเงียบ ๆ (ตอบกลับเป็น response
  // ว่าง) พอ HMR ต่อไม่ติด หน้าเว็บก็ hydrate ไม่สำเร็จ ปุ่มทุกปุ่มเลยกดไม่ได้โดยไม่มี
  // error บอก ประกาศ origin ทั้งสองชื่อไว้เพื่อให้เข้าทางไหนก็ใช้งานได้เหมือนกัน
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: `default-src 'self'; ${scriptSources}; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'` },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
      ],
    }];
  },
};

export default nextConfig;
