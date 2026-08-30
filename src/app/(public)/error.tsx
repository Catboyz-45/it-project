/**
 * หน้าที่ของไฟล์นี้: หน้าหรือส่วนรับข้อผิดพลาดและแสดงข้อความที่ปลอดภัย โดยไม่เปิดเผยรายละเอียดระบบภายใน
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";
import { ErrorView } from "@/components/error-view";
/** สร้างส่วนหน้าจอ PublicError; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default function PublicError({ reset, error }: { reset: () => void; error: Error & { digest?: string } }) { return <div className="container section"><ErrorView reset={reset} reference={error.digest} /></div>; }
