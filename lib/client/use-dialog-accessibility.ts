"use client";

import { useEffect, useRef, type RefObject } from "react";

// องค์ประกอบที่โฟกัสด้วย Tab ได้ ใช้หาขอบเขตของกับดักโฟกัสในกล่องโต้ตอบ
const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

// ลำดับการเลือกว่าจะโฟกัสอะไรก่อนตอนเปิดกล่อง ไล่จากที่ระบุไว้เอง ไปช่องกรอกแรก แล้วค่อยหัวเรื่อง
const initialFocusSelectors = [
  "[data-dialog-initial-focus]",
  "input:not([disabled]):not([type='hidden']), select:not([disabled]), textarea:not([disabled]), [contenteditable='true']",
  "h1, h2, h3",
];

// เช็คว่ามองเห็นจริง ไม่ใช่แค่มีอยู่ใน DOM ของที่ซ่อนไว้ต้องไม่ถูกนับเป็นเป้าโฟกัส
function isVisible(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  return element.getClientRects().length > 0
    && style.display !== "none"
    && style.visibility !== "hidden";
}

// ทำให้กล่องโต้ตอบใช้งานด้วยคีย์บอร์ดได้ตามมาตรฐาน ARIA
// สามอย่าง Esc ปิดได้ Tab วนอยู่ในกล่อง และคืนโฟกัสให้ที่เดิมตอนปิด
export function useDialogAccessibility(
  dialogRef: RefObject<HTMLElement | null>,
  onRequestClose: () => void,
  enabled = true,
) {
  // เก็บไว้ใน ref เพราะ effect ข้างล่างไม่ควรผูกกลับมาใหม่ทุกครั้งที่ผู้เรียกส่งฟังก์ชันตัวใหม่มา
  const closeRef = useRef(onRequestClose);
  useEffect(() => { closeRef.current = onRequestClose; }, [onRequestClose]);

  useEffect(() => {
    if (!enabled) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    // จำไว้ว่าก่อนเปิดกล่องโฟกัสอยู่ที่ไหน ปิดแล้วจะได้คืนให้ที่เดิม
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // หาใหม่ทุกครั้งที่กด Tab ไม่ได้เก็บไว้ เพราะเนื้อหาในกล่องเปลี่ยนได้ระหว่างเปิดอยู่
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
      .filter((element) => (
        !element.hidden
        && element.getAttribute("aria-hidden") !== "true"
        && !element.matches(":disabled")
        && isVisible(element)
      ));
    const initialFocus = initialFocusSelectors
      .map((selector) => Array.from(dialog.querySelectorAll<HTMLElement>(selector)).find(isVisible))
      .find((element): element is HTMLElement => Boolean(element));
    const addedInitialTabIndex = initialFocus
      && !initialFocus.matches(focusableSelector)
      && !initialFocus.hasAttribute("tabindex");
    // หัวเรื่องปกติโฟกัสไม่ได้ ใส่ -1 ชั่วคราวแล้วถอดออกตอนปิด จะได้ไม่ทิ้งร่องรอยไว้ใน DOM
    if (addedInitialTabIndex) initialFocus.setAttribute("tabindex", "-1");
    (initialFocus ?? focusable()[0] ?? dialog).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      // กล่องซ้อนกันได้ เช่นกล่องยืนยันที่เปิดบนฟอร์ม ให้เฉพาะกล่องบนสุดตอบสนองคีย์บอร์ด
      // ไม่งั้นกด Esc ทีเดียวจะปิดทั้งสองชั้นพร้อมกัน
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
      // ไม่มีอะไรให้โฟกัสเลยก็โฟกัสที่ตัวกล่อง โฟกัสจะได้ไม่หลุดออกไปข้างนอก
      if (elements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = elements[0];
      const last = elements.at(-1)!;
      // ถึงตัวแรกแล้วกด Shift+Tab ให้วนไปตัวสุดท้าย และในทางกลับกัน
      // นี่คือกับดักโฟกัส ทำให้คนที่ใช้คีย์บอร์ดหรือโปรแกรมอ่านหน้าจอไม่หลุดออกไปหลังกล่อง
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
      // คืนโฟกัสให้ที่เดิมตอนปิด ผู้ใช้จะได้ทำงานต่อจากจุดที่ค้างไว้
      previouslyFocused?.focus();
    };
  }, [dialogRef, enabled]);
}
