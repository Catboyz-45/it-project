/**
 * หน้าที่ของไฟล์นี้: หน้าหรือส่วนรับข้อผิดพลาดและแสดงข้อความที่ปลอดภัย โดยไม่เปิดเผยรายละเอียดระบบภายใน
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

/** สร้างส่วนหน้าจอ ErrorView; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function ErrorView({ reset, reference }: { reset: () => void; reference?: string }) {
  return <div className="empty-state" role="alert"><div><span className="dialog-icon danger" style={{ marginInline: "auto" }}><AlertTriangle size={24} /></span><h1 className="subheading" style={{ marginTop: 18 }}>ไม่สามารถโหลดข้อมูลได้</h1><p className="muted">เกิดข้อผิดพลาดชั่วคราว กรุณาลองใหม่อีกครั้ง หากปัญหายังเกิดขึ้นโปรดแจ้งผู้ดูแลระบบ{reference ? ` พร้อมรหัส ${reference}` : ""}</p><button className="btn btn-dark" onClick={reset}><RotateCcw size={17} /> ลองใหม่</button></div></div>;
}
