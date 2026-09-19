"use client";
// แตะ document และดักคีย์บอร์ดของเบราว์เซอร์

import { type MouseEvent, type ReactNode, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useDialogAccessibility } from "@/lib/client/use-dialog-accessibility";

type DialogProps = {
  // id ของข้อความอธิบาย ให้โปรแกรมอ่านหน้าจออ่านต่อจากหัวเรื่อง
  ariaDescribedBy: string;
  // ใช้ ariaLabel เมื่อไม่มีหัวเรื่องที่มองเห็น ไม่งั้นใช้ ariaLabelledBy ชี้ไปที่หัวเรื่องนั้น
  ariaLabel?: string;
  ariaLabelledBy?: string;
  backdropClassName?: string;
  children: ReactNode;
  // ใช้กำหนดความกว้าง เช่น modal-sm / modal-md
  className?: string;
  // ปิดเริ่มต้นไว้ กันผู้ใช้เผลอคลิกพื้นหลังแล้วข้อมูลที่กรอกหายไป
  closeOnBackdrop?: boolean;
  onClose: () => void;
  // alertdialog ใช้กับเรื่องที่ต้องตอบก่อนไปต่อ โปรแกรมอ่านหน้าจอจะเน้นกว่า dialog ธรรมดา
  role?: "dialog" | "alertdialog";
};

function joinClassNames(...classNames: Array<string | undefined | false>) {
  return classNames.filter(Boolean).join(" ");
}

export function Dialog({
  ariaDescribedBy,
  ariaLabel,
  ariaLabelledBy,
  backdropClassName,
  children,
  className,
  closeOnBackdrop = false,
  onClose,
  role = "dialog",
}: DialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  // จัดการ Esc ขังโฟกัสไว้ในกล่อง และคืนโฟกัสให้ปุ่มเดิมตอนปิด
  useDialogAccessibility(dialogRef, onClose);

  // เช็ค target === currentTarget เพื่อให้ปิดเฉพาะตอนคลิกพื้นหลังจริง ๆ
  // ไม่ใช่ตอนคลิกอะไรข้างในแล้ว event ลอยขึ้นมา
  const handleBackdropClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdrop && event.target === event.currentTarget) onClose();
  }, [closeOnBackdrop, onClose]);

  // กล่องที่ไม่มีชื่อ โปรแกรมอ่านหน้าจอจะอ่านว่า "dialog" เฉย ๆ จึงหยุดตั้งแต่ตอนพัฒนา
  if (!ariaLabel && !ariaLabelledBy) {
    throw new Error("Dialog requires ariaLabel or ariaLabelledBy");
  }

  // ตอน render ฝั่งเซิร์ฟเวอร์ยังไม่มี document ให้ portal ไปวาง
  if (typeof document === "undefined") return null;

  // ย้ายไปไว้ท้าย body กัน overflow หรือ z-index ของการ์ดที่ครอบอยู่มาตัดกล่องขาด
  return createPortal(
    <div
      className={joinClassNames("modal-backdrop", backdropClassName)}
      // ใช้ onMouseDown ไม่ใช่ onClick กันกรณีลากเลือกข้อความในกล่องแล้วปล่อยเมาส์นอกกล่อง
      onMouseDown={handleBackdropClick}
      // presentation บอกว่าพื้นหลังเป็นแค่ฉาก ไม่ใช่ส่วนที่มีความหมาย
      role="presentation"
    >
      <section
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        // บอกว่าส่วนอื่นของหน้าถูกบังอยู่ โปรแกรมอ่านหน้าจอจะไม่หลุดออกไปอ่านข้างนอก
        aria-modal="true"
        className={joinClassNames("modal", className)}
        ref={dialogRef}
        role={role}
        // -1 ให้โฟกัสด้วยโค้ดได้ แต่ผู้ใช้กด Tab มาโดนเองไม่ได้
        tabIndex={-1}
      >
        {children}
      </section>
    </div>,
    document.body,
  );
}
