/**
 * หน้าที่ของไฟล์นี้: React Hook use-modal-accessibility สำหรับรวมพฤติกรรมฝั่งเบราว์เซอร์ที่หลายคอมโพเนนต์เรียกใช้ร่วมกัน
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";

import type { RefObject } from "react";
import { useEffect, useRef } from "react";

const focusableSelector = [
  "a[href]", "button:not([disabled])", "input:not([disabled])", "select:not([disabled])",
  "textarea:not([disabled])", "[tabindex]:not([tabindex='-1'])",
].join(",");

type ModalAccessibilityOptions = {
  active?: boolean;
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  closeDisabled?: boolean;
};

/** React Hook useModalAccessibility รวม state และพฤติกรรมฝั่ง browser เพื่อให้คอมโพเนนต์เรียกใช้ตามกฎเดียวกัน */
export function useModalAccessibility({ active = true, containerRef, initialFocusRef, restoreFocusRef, onClose, closeDisabled = false }: ModalAccessibilityOptions) {
  const onCloseRef = useRef(onClose);
  const closeDisabledRef = useRef(closeDisabled);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { closeDisabledRef.current = closeDisabled; }, [closeDisabled]);
  useEffect(() => {
    if (!active) {
      const rememberFocus = (event: FocusEvent) => {
        if (
          event.target instanceof HTMLElement &&
          !containerRef.current?.contains(event.target)
        ) returnFocusRef.current = event.target;
      };
      if (document.activeElement instanceof HTMLElement) returnFocusRef.current = document.activeElement;
      document.addEventListener("focusin", rememberFocus);
      return () => document.removeEventListener("focusin", rememberFocus);
    }
    const previousFocus = restoreFocusRef?.current ?? returnFocusRef.current;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusInitial = () => {
      if (containerRef.current?.contains(document.activeElement)) return;
      const target = initialFocusRef?.current ?? containerRef.current?.querySelector<HTMLElement>("[autofocus]") ?? containerRef.current?.querySelector<HTMLElement>(focusableSelector) ?? containerRef.current;
      target?.focus();
    };
    const frame = window.requestAnimationFrame(focusInitial);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!closeDisabledRef.current) { event.preventDefault(); onCloseRef.current(); }
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(containerRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])]
        .filter(element => !element.hidden && element.getAttribute("aria-hidden") !== "true");
      if (!focusable.length) { event.preventDefault(); containerRef.current?.focus(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !containerRef.current?.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = bodyOverflow;
      window.requestAnimationFrame(() => {
        if (previousFocus?.isConnected) previousFocus.focus();
      });
    };
  }, [active, containerRef, initialFocusRef, restoreFocusRef]);
}
