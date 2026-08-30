/**
 * หน้าที่ของไฟล์นี้: หน้าหรือส่วนรับข้อผิดพลาดและแสดงข้อความที่ปลอดภัย โดยไม่เปิดเผยรายละเอียดระบบภายใน
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";

/** สร้างส่วนหน้าจอ GlobalError; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="th"><body><main style={{ maxWidth: 640, margin: "15vh auto", padding: 24, fontFamily: "sans-serif" }}><h1>ระบบขัดข้องชั่วคราว</h1><p>กรุณาลองอีกครั้ง หากปัญหายังคงอยู่ให้แจ้งผู้ดูแลพร้อมเวลาที่เกิดเหตุ</p><button onClick={reset}>ลองอีกครั้ง</button></main></body></html>;
}
