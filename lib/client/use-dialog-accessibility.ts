"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นตัวช่วยฝั่งเบราว์เซอร์สำหรับ “use dialog accessibility” เช่น interaction การเรียก API หรือสถานะหน้าจอ
 * การทำงาน: ทำงานหลังหน้าโหลดแล้วและต้องถือว่าข้อมูลจากผู้ใช้ไม่น่าเชื่อถือ; เซิร์ฟเวอร์ยังต้องตรวจข้อมูลและสิทธิ์ซ้ำเสมอ
 */

import { useEffect, useRef, type RefObject } from "react";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const initialFocusSelectors = [
  "[data-dialog-initial-focus]",
  "input:not([disabled]):not([type='hidden']), select:not([disabled]), textarea:not([disabled]), [contenteditable='true']",
  "h1, h2, h3",
];

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบว่าเงื่อนไข “is Visible” เป็นจริงหรือไม่ เพื่อใช้ตัดสินใจในขั้นตอนถัดไป
 * รับค่า:
 * - element: ค่า “element” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function isVisible(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  return element.getClientRects().length > 0
    && style.display !== "none"
    && style.visibility !== "hidden";
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: React hook “use Dialog Accessibility” รวม state และพฤติกรรมที่คอมโพเนนต์นำกลับมาใช้ซ้ำ
 * รับค่า:
 * - dialogRef: ค่า “dialog Ref” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - onRequestClose: ค่า “on Request Close” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - enabled: ค่า “enabled” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function useDialogAccessibility(
  dialogRef: RefObject<HTMLElement | null>,
  onRequestClose: () => void,
  enabled = true,
) {
  const closeRef = useRef(onRequestClose);
  useEffect(() => { closeRef.current = onRequestClose; }, [onRequestClose]);

  useEffect(() => {
    if (!enabled) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “focusable” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
      .filter((element) => (
        !element.hidden
        && element.getAttribute("aria-hidden") !== "true"
        && !element.matches(":disabled")
        && isVisible(element)
      ));
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “initial Focus” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - element: ค่า “element” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนข้อมูลชนิด element is HTMLElement ตามสัญญา TypeScript ของฟังก์ชัน
     */
    const initialFocus = initialFocusSelectors
      .map((selector) => Array.from(dialog.querySelectorAll<HTMLElement>(selector)).find(isVisible))
      .find((element): element is HTMLElement => Boolean(element));
    const addedInitialTabIndex = initialFocus
      && !initialFocus.matches(focusableSelector)
      && !initialFocus.hasAttribute("tabindex");
    if (addedInitialTabIndex) initialFocus.setAttribute("tabindex", "-1");
    (initialFocus ?? focusable()[0] ?? dialog).focus();

    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รับเหตุการณ์ “on Key Down” จากผู้ใช้หรือระบบ แล้วเรียกขั้นตอนที่เกี่ยวข้อง
     * รับค่า:
     * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const openDialogs = Array.from(document.querySelectorAll<HTMLElement>("[role='dialog'][aria-modal='true'], [role='alertdialog'][aria-modal='true']"))
        .filter(isVisible);
      if (openDialogs.at(-1) !== dialog) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (elements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = elements[0];
      const last = elements.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (addedInitialTabIndex) initialFocus?.removeAttribute("tabindex");
      previouslyFocused?.focus();
    };
  }, [dialogRef, enabled]);
}
