"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “use confirmation” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { useCallback, useState } from "react";
import { ConfirmationDialog } from "@/components/dorm/ConfirmationDialog";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Confirmation” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Confirmation = {
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: "default" | "danger";
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: React hook “use Confirmation” รวม state และพฤติกรรมที่คอมโพเนนต์นำกลับมาใช้ซ้ำ
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function useConfirmation() {
  const [pending, setPending] = useState<(Confirmation & { resolve: (value: boolean) => void }) | null>(null);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “confirm” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - options: ตัวเลือกเพิ่มเติมที่ปรับพฤติกรรมของฟังก์ชัน
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const confirm = useCallback((options: Confirmation) => new Promise<boolean>((resolve) => {
    setPending({ ...options, resolve });
  }), []);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “close” ตามกฎของระบบ
   * รับค่า:
   * - result: ค่า “result” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const close = (result: boolean) => {
    pending?.resolve(result);
    setPending(null);
  };
  const confirmationDialog = pending ? <ConfirmationDialog
    confirmLabel={pending.confirmLabel}
    description={pending.description}
    onCancel={() => close(false)}
    onConfirm={() => close(true)}
    title={pending.title}
    variant={pending.variant}
  /> : null;
  return { confirm, confirmationDialog };
}
