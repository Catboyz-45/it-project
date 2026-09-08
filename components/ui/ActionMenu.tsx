"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Action Menu” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Action Menu Item” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type ActionMenuItem = {
  disabled?: boolean;
  icon?: ReactNode;
  id: string;
  label: string;
  onSelect: () => void;
  variant?: "default" | "danger";
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Action Menu” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { align = "end", items, label = "เปิดเมนูจัดการ", }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function ActionMenu({
  align = "end",
  items,
  label = "เปิดเมนูจัดการ",
}: {
  align?: "start" | "end";
  items: ActionMenuItem[];
  label?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>();
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “find Removal Fallback” แล้วส่งผลที่เหมาะสมกลับไป
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
   */
  const findRemovalFallback = () => {
    const trigger = triggerRef.current;
    const row = trigger?.closest("tr");
    const table = row?.closest("table");
    if (row && table) {
      const rows = Array.from(table.querySelectorAll("tbody tr"));
      const rowIndex = rows.indexOf(row);
      const nearbyRows = [...rows.slice(rowIndex + 1), ...rows.slice(0, rowIndex).reverse()];
      for (const nearbyRow of nearbyRows) {
        const control = nearbyRow.querySelector<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled)',
        );
        if (control) return control;
      }
    }

    return trigger?.closest<HTMLElement>("article, section")?.querySelector<HTMLElement>("h2, h3") ?? null;
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “focus Element” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - element: ค่า “element” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const focusElement = (element: HTMLElement | null) => {
    if (!element?.isConnected) return;
    if (!element.matches('button, a[href], input, select, textarea, [tabindex]')) {
      element.setAttribute("tabindex", "-1");
    }
    element.focus({ preventScroll: true });
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “preserve Focus After Action” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - trigger: ค่า “trigger” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - fallback: ค่า “fallback” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const preserveFocusAfterAction = (trigger: HTMLButtonElement, fallback: HTMLElement | null) => {
    window.requestAnimationFrame(() => {
      const activeElement = document.activeElement;
      if (activeElement === document.body || menuRef.current?.contains(activeElement)) {
        focusElement(trigger.isConnected ? trigger : fallback);
      }
    });

    const observer = new MutationObserver(() => {
      if (trigger.isConnected) return;
      const activeElement = document.activeElement;
      if (activeElement === document.body || !activeElement?.isConnected) focusElement(fallback);
      observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 2_000);
  };

  useEffect(() => {
    if (!isOpen) return;

    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “close On Outside Interaction” ตามกฎของระบบ
     * รับค่า:
     * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
    const closeOnOutsideInteraction = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setIsOpen(false);
    };
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “close On Escape” ตามกฎของระบบ
     * รับค่า:
     * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", closeOnOutsideInteraction);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideInteraction);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setMenuStyle(undefined);
      return;
    }

    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “position Menu” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
    const positionMenu = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const triggerRect = trigger.getBoundingClientRect();
      const menuRect = menuRef.current?.getBoundingClientRect();
      const width = menuRect?.width ?? 176;
      const height = menuRect?.height ?? Math.max(56, items.length * 44 + 12);
      const viewportPadding = 12;
      const gap = 8;
      const desiredLeft = align === "end" ? triggerRect.right - width : triggerRect.left;
      const left = Math.min(window.innerWidth - width - viewportPadding, Math.max(viewportPadding, desiredLeft));
      const below = triggerRect.bottom + gap;
      const top = below + height <= window.innerHeight - viewportPadding
        ? below
        : Math.max(viewportPadding, triggerRect.top - height - gap);
      setMenuStyle({ left, top });
    };

    positionMenu();
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “frame” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
    const frame = window.requestAnimationFrame(() => {
      positionMenu();
      menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
    });
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [align, isOpen, items.length]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “move Focus” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const moveFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isOpen || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);
    if (!buttons.length) return;
    event.preventDefault();
    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : event.key === "ArrowDown" ? (currentIndex + 1) % buttons.length : (currentIndex - 1 + buttons.length) % buttons.length;
    buttons[nextIndex]?.focus();
  };

  return (
    <div className="action-menu" ref={rootRef}>
      <IconButton
        aria-controls={isOpen ? menuId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        label={label}
        onClick={() => setIsOpen((current) => !current)}
        ref={triggerRef}
      >
        <MoreHorizontal aria-hidden="true" size={18} />
      </IconButton>
      {isOpen && menuStyle && typeof document !== "undefined" ? createPortal(
        <div aria-label={label} className={`action-menu-popover action-menu-${align}`} id={menuId} onKeyDown={moveFocus} ref={menuRef} role="menu" style={menuStyle}>
          {items.map((item, index) => (
            <button
              autoFocus={index === items.findIndex((candidate) => !candidate.disabled)}
              className={item.variant === "danger" ? "action-menu-danger" : undefined}
              disabled={item.disabled}
              key={item.id}
              onClick={() => {
                const trigger = triggerRef.current;
                const fallback = findRemovalFallback();
                setIsOpen(false);
                // Move focus out of the portalled menu before it is removed. This also
                // gives dialogs opened by the action a stable element to restore to.
                trigger?.focus({ preventScroll: true });
                item.onSelect();
                if (trigger) preserveFocusAfterAction(trigger, fallback);
              }}
              role="menuitem"
              type="button"
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
