"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Dialog” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { type MouseEvent, type ReactNode, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useDialogAccessibility } from "@/lib/client/use-dialog-accessibility";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Dialog Props” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type DialogProps = {
  ariaDescribedBy: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  backdropClassName?: string;
  children: ReactNode;
  className?: string;
  closeOnBackdrop?: boolean;
  onClose: () => void;
  role?: "dialog" | "alertdialog";
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “join Class Names” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - classNames: ค่า “class Names” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function joinClassNames(...classNames: Array<string | undefined | false>) {
  return classNames.filter(Boolean).join(" ");
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Dialog” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { ariaDescribedBy, ariaLabel, ariaLabelledBy, backdropClassN: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
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
  useDialogAccessibility(dialogRef, onClose);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รับเหตุการณ์ “handle Backdrop Click” จากผู้ใช้หรือระบบ แล้วเรียกขั้นตอนที่เกี่ยวข้อง
   * รับค่า:
   * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const handleBackdropClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdrop && event.target === event.currentTarget) onClose();
  }, [closeOnBackdrop, onClose]);

  if (!ariaLabel && !ariaLabelledBy) {
    throw new Error("Dialog requires ariaLabel or ariaLabelledBy");
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={joinClassNames("modal-backdrop", backdropClassName)}
      onMouseDown={handleBackdropClick}
      role="presentation"
    >
      <section
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-modal="true"
        className={joinClassNames("modal", className)}
        ref={dialogRef}
        role={role}
        tabIndex={-1}
      >
        {children}
      </section>
    </div>,
    document.body,
  );
}
