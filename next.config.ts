
import type { NextConfig } from "next";

// ตอน dev ต้องเปิด unsafe-eval ให้ Turbopack ทำงานได้ แต่ห้ามติดไปโปรดักชันเด็ดขาด
const scriptSources = process.env.NODE_ENV === "development"
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

// ทุกเส้นทางใช้นโยบายเดียวกัน ต่างกันแค่ใครเอาหน้าไปใส่ iframe ได้
const contentSecurityPolicy = (frameAncestors: string) =>
  `default-src 'self'; ${scriptSources}; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors ${frameAncestors}; form-action 'self'`;

const nextConfig: NextConfig = {
  // Docker ใช้ .next/standalone ตรง ๆ ได้ไฟล์ server.js พร้อม node_modules เท่าที่ใช้จริง image จึงเล็ก
  output: "standalone",
  // ปิด header ที่บอกว่าเว็บนี้ใช้ Next ไม่มีประโยชน์กับผู้ใช้ มีแต่บอกคนสแกนช่องโหว่
  poweredByHeader: false,
  // เซิร์ฟเวอร์ dev ของ Next ยอมรับเฉพาะ origin "localhost" เป็นค่าเริ่มต้น เปิดหน้าเว็บ
  // ผ่าน 127.0.0.1 แล้ว WebSocket ของ HMR จะถูกปฏิเสธเงียบ ๆ (ตอบกลับเป็น response
  // ว่าง) พอ HMR ต่อไม่ติด หน้าเว็บก็ hydrate ไม่สำเร็จ ปุ่มทุกปุ่มเลยกดไม่ได้โดยไม่มี
  // error บอก ประกาศ origin ทั้งสองชื่อไว้เพื่อให้เข้าทางไหนก็ใช้งานได้เหมือนกัน
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  // header ความปลอดภัยชุดเดียว ใส่ให้ทุกเส้นทางผ่าน source "/(.*)"
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy("'none'") },
        // ข้ามเว็บอื่นส่งไปแค่ชื่อโดเมน ไม่ส่งพาธเต็มที่อาจมีรหัสห้องหรือรหัสผู้ใช้ติดไป
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        // ห้ามเว็บอื่นเอาหน้าเราไปใส่ iframe กันการหลอกให้กดปุ่มโดยไม่รู้ตัว
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        // HSTS ใส่เฉพาะโปรดักชัน ใส่ตอน dev แล้วเบราว์เซอร์จะจำและบังคับ https กับ localhost ไปด้วย
        ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
      ],
    },
    // ไฟล์สลิปต้องแสดงในกรอบของหน้าตรวจสลิปบนโดเมนเราเอง ถ้าห้าม iframe ทุกที่ ช่องแสดงสลิปจะว่างเปล่า
    // กฎนี้อยู่หลังกฎรวม Next จึงใช้ค่านี้แทนเฉพาะสองเส้นทางนี้ เว็บอื่นยังเอาไปใส่กรอบไม่ได้เหมือนเดิม
    ...[
      "/api/v1/admin/properties/:propertyId/payment-submissions/:paymentId/slip",
      "/api/v1/super-admin/subscription-payments/:paymentId/slip",
    ].map((source) => ({
      source,
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy("'self'") },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
      ],
    }))];
  },
};

export default nextConfig;
