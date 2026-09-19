"use client";
// ต้องเป็น Client Component เพราะเก็บ state และ render กล่องโต้ตอบ

import { useCallback, useState } from "react";
import { ConfirmationDialog } from "@/components/dorm/ConfirmationDialog";

// ข้อความและรูปแบบของกล่องยืนยันแต่ละครั้ง
type Confirmation = {
  title: string;
  description: string;
  // ข้อความบนปุ่มยืนยัน ถ้าไม่ส่งมากล่องจะใช้คำเริ่มต้นของมันเอง
  confirmLabel?: string;
  // danger ใช้กับการกระทำที่ย้อนกลับไม่ได้ เช่น ลบข้อมูล
  variant?: "default" | "danger";
};

/**
 * ทำให้กล่องยืนยันเรียกใช้ง่ายเหมือน window.confirm แต่เป็นกล่องของเราเอง
 *
 * ปัญหาที่แก้: กล่องยืนยันเป็น UI ที่ต้อง render ส่วนโค้ดที่อยากถามเป็นตรรกะ
 * ปกติจะต้องสร้าง state เปิด/ปิด แล้วแยกโค้ดหลังกดยืนยันไปไว้อีกที่ อ่านยาก
 *
 * hook นี้รวบให้เขียนต่อกันเป็นบรรทัดเดียวได้:
 *   if (!(await confirm({ title, description }))) return;
 *   ...โค้ดที่ทำต่อเมื่อผู้ใช้กดยืนยัน
 *
 * วิธีใช้: เอา confirm ไปเรียกตอนต้องการถาม และวาง confirmationDialog ไว้ใน JSX
 * ของหน้า ไม่งั้นกล่องจะไม่ถูก render ออกมา
 */
export function useConfirmation() {
  // เก็บคำถามที่ค้างอยู่ พร้อม resolve ของ Promise ที่รอคำตอบ
  // เป็น null แปลว่าตอนนี้ไม่ได้ถามอะไรอยู่ กล่องจึงไม่ถูกแสดง
  const [pending, setPending] = useState<(Confirmation & { resolve: (value: boolean) => void }) | null>(null);

  // คืน Promise ที่ยัง "ค้าง" ไว้ก่อน แล้วเก็บ resolve ไว้ใน state
  // ตัว Promise จะยังไม่จบจนกว่าผู้ใช้จะกดปุ่ม ทำให้ฝั่งที่เรียกใช้ await รอได้
  const confirm = useCallback((options: Confirmation) => new Promise<boolean>((resolve) => {
    setPending({ ...options, resolve });
  }), []);

  // เรียกเมื่อผู้ใช้ตอบแล้ว: ส่งคำตอบกลับไปให้ Promise ที่รออยู่ แล้วล้าง state เพื่อปิดกล่อง
  const close = (result: boolean) => {
    pending?.resolve(result);
    setPending(null);
  };

  // มีคำถามค้างอยู่จึงสร้างกล่อง ถ้าไม่มีก็เป็น null คือไม่ render อะไรเลย
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
