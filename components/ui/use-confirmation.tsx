"use client";
// เก็บ state และ render กล่องโต้ตอบ

import { useCallback, useState } from "react";
import { ConfirmationDialog } from "@/components/dorm/ConfirmationDialog";

type Confirmation = {
  title: string;
  description: string;
  // ไม่ส่งมาก็ได้ กล่องจะใช้คำเริ่มต้นของมันเอง
  confirmLabel?: string;
  // danger ใช้กับการกระทำที่ย้อนกลับไม่ได้ เช่น ลบข้อมูล
  variant?: "default" | "danger";
};

// ถามยืนยันแบบ await ได้:  if (!(await confirm({ title, description }))) return;
// ต้องวาง confirmationDialog ไว้ใน JSX ของหน้าด้วย ไม่งั้นกล่องไม่ถูก render
export function useConfirmation() {
  // null = ไม่ได้ถามอะไรอยู่ กล่องจึงไม่แสดง
  const [pending, setPending] = useState<(Confirmation & { resolve: (value: boolean) => void }) | null>(null);

  // เก็บ resolve ไว้ใน state แล้วปล่อย Promise ค้าง จนกว่าผู้ใช้จะกดปุ่ม
  const confirm = useCallback((options: Confirmation) => new Promise<boolean>((resolve) => {
    setPending({ ...options, resolve });
  }), []);

  // ส่งคำตอบกลับให้ Promise ที่รออยู่ แล้วล้าง state เพื่อปิดกล่อง
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
