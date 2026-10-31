"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

// กล่องถามยืนยันที่ใช้ร่วมกันทั้งระบบ ใช้ผ่าน useConfirmation จะสะดวกกว่าเรียกตรง ๆ
export function ConfirmationDialog({
  confirmLabel = "ยืนยัน",
  // ปิดปุ่มทั้งหมดระหว่างกำลังทำงาน กันกดยืนยันซ้ำหรือปิดกล่องทิ้งกลางคัน
  confirmDisabled = false,
  description,
  onCancel,
  onConfirm,
  title,
  // danger ทำให้ปุ่มยืนยันเป็นสีแดง ใช้กับการลบหรือสิ่งที่ย้อนกลับไม่ได้
  variant = "default",
}: Readonly<{
  confirmLabel?: string;
  confirmDisabled?: boolean;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  variant?: "default" | "danger";
}>) {
  // Esc กับคลิกพื้นหลังวิ่งมาที่นี่ ต้องไม่ยอมให้ปิดตอนกำลังทำงานอยู่
  const requestClose = useCallback(() => { if (!confirmDisabled) onCancel(); }, [confirmDisabled, onCancel]);
  return <Dialog
    ariaDescribedBy="confirmation-dialog-description"
    ariaLabelledBy="confirmation-dialog-title"
    // ยกให้สูงกว่ากล่องอื่น เพราะมักถูกเปิดซ้อนบนกล่องที่เปิดอยู่แล้ว
    backdropClassName="z-[110]"
    className="confirmation-modal"
    onClose={requestClose}
    // alertdialog ไม่ใช่ dialog เพราะเป็นเรื่องที่ต้องตอบก่อนไปต่อ
    role="alertdialog"
  >
      {/* แบบกล่องยืนยันของ YouTube: หัวเรื่องกับคำอธิบายสั้น ๆ ไม่มีปุ่ม X เพราะปุ่มยกเลิกกับ Esc ปิดได้อยู่แล้ว
          ความอันตรายบอกด้วยสีของปุ่มยืนยัน บนมือถือ CSS จัดเป็นกล่องแบบ iOS alert ให้เอง */}
      <header className="modal-header">
        <h2 id="confirmation-dialog-title">{title}</h2>
        <p id="confirmation-dialog-description">{description}</p>
      </header>
      <footer className="modal-actions">
        <Button disabled={confirmDisabled} onClick={onCancel} variant="secondary">ยกเลิก</Button>
        <Button disabled={confirmDisabled} onClick={onConfirm} variant={variant === "danger" ? "danger" : "primary"}>{confirmLabel}</Button>
      </footer>
  </Dialog>;
}
