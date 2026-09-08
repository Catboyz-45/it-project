"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Confirmation Dialog” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { useCallback } from "react";
import { TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Confirmation Dialog” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { confirmLabel = "ยืนยัน", confirmDisabled = false, descript: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function ConfirmationDialog({
  confirmLabel = "ยืนยัน",
  confirmDisabled = false,
  description,
  onCancel,
  onConfirm,
  title,
  variant = "default",
}: {
  confirmLabel?: string;
  confirmDisabled?: boolean;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  variant?: "default" | "danger";
}) {
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “request Close” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const requestClose = useCallback(() => { if (!confirmDisabled) onCancel(); }, [confirmDisabled, onCancel]);
  return <Dialog
    ariaDescribedBy="confirmation-dialog-description"
    ariaLabelledBy="confirmation-dialog-title"
    backdropClassName="z-[110]"
    className="confirmation-modal confirmation-alert-modal"
    onClose={requestClose}
    role="alertdialog"
  >
      <header className={`modal-header confirmation-dialog-header ${variant === "danger" ? "danger" : ""}`}>
        <div className="confirmation-dialog-copy">
          {variant === "danger" ? <span aria-hidden="true" className="confirmation-dialog-icon"><TriangleAlert size={24} /></span> : null}
          <div><h2 id="confirmation-dialog-title">{title}</h2><p id="confirmation-dialog-description">{description}</p></div>
        </div>
        <Button aria-label="ปิด" disabled={confirmDisabled} onClick={onCancel} variant="icon"><X aria-hidden="true" size={28} /></Button>
      </header>
      <footer className="modal-actions">
        <Button disabled={confirmDisabled} onClick={onCancel} variant="secondary">ยกเลิก</Button>
        <Button disabled={confirmDisabled} onClick={onConfirm} variant={variant === "danger" ? "danger" : "primary"}>{confirmLabel}</Button>
      </footer>
  </Dialog>;
}
