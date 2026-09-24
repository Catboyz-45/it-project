"use client";
// เก็บสถานะเปิดปิด วัดตำแหน่งจาก DOM และย้ายโฟกัสเอง

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { rovingIndex } from "@/components/ui/use-tablist-keyboard";

export type ActionMenuItem = {
  disabled?: boolean;
  icon?: ReactNode;
  // ต้องไม่ซ้ำกันในเมนูเดียว เพราะใช้เป็น key ของ React
  id: string;
  label: string;
  onSelect: () => void;
  // danger ทำให้เป็นสีแดง ใช้กับรายการที่ลบหรือย้อนกลับไม่ได้
  variant?: "default" | "danger";
};

// เมนูจุดสามจุดท้ายแถวตาราง เก็บคำสั่งที่ไม่ได้ใช้บ่อยไว้ไม่ให้แถวรก
export function ActionMenu({
  // end = ชิดขวาปุ่ม ใช้กับเมนูท้ายแถว start = ชิดซ้าย
  align = "end",
  items,
  label = "เปิดเมนูจัดการ",
}: Readonly<{
  align?: "start" | "end";
  items: ActionMenuItem[];
  label?: string;
}>) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>();
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // หาที่ลงของโฟกัสไว้ล่วงหน้า เผื่อคำสั่งที่เลือกลบแถวที่ปุ่มนี้อยู่ทิ้ง
  // ถ้าไม่เตรียมไว้ โฟกัสจะตกไปที่ body แล้วคนใช้คีย์บอร์ดต้อง Tab ใหม่จากต้นหน้า
  const findRemovalFallback = () => {
    const trigger = triggerRef.current;
    const row = trigger?.closest("tr");
    const table = row?.closest("table");
    if (row && table) {
      const rows = Array.from(table.querySelectorAll("tbody tr"));
      const rowIndex = rows.indexOf(row);
      // ไล่หาแถวถัดไปก่อน ถ้าไม่มีค่อยย้อนขึ้นข้างบน ให้โฟกัสอยู่ใกล้จุดเดิมที่สุด
      const nearbyRows = [...rows.slice(rowIndex + 1), ...rows.slice(0, rowIndex).reverse()];
      for (const nearbyRow of nearbyRows) {
        const control = nearbyRow.querySelector<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled)',
        );
        if (control) return control;
      }
    }

    // ไม่ได้อยู่ในตาราง หรือลบจนไม่เหลือแถว ก็ถอยไปที่หัวเรื่องของการ์ดที่ครอบอยู่
    return trigger?.closest<HTMLElement>("article, section")?.querySelector<HTMLElement>("h2, h3") ?? null;
  };

  const focusElement = (element: HTMLElement | null) => {
    // ถูกถอดออกจากหน้าไปแล้วก็โฟกัสไม่ได้ ต้องเช็คก่อน
    if (!element?.isConnected) return;
    // หัวเรื่องปกติโฟกัสไม่ได้ ใส่ -1 ให้โฟกัสด้วยโค้ดได้ แต่ผู้ใช้กด Tab มาโดนเองไม่ได้
    if (!element.matches('button, a[href], input, select, textarea, [tabindex]')) {
      element.setAttribute("tabindex", "-1");
    }
    // preventScroll กันหน้าเด้งไปมาตอนโฟกัสย้าย
    element.focus({ preventScroll: true });
  };

  // กันโฟกัสหลุดหายหลังกดคำสั่ง มีสองจังหวะที่ต้องดัก
  const preserveFocusAfterAction = (trigger: HTMLButtonElement, fallback: HTMLElement | null) => {
    // จังหวะแรก หลัง render รอบถัดไป ถ้าโฟกัสตกไป body ก็ดึงกลับมาที่ปุ่มเดิม
    window.requestAnimationFrame(() => {
      const activeElement = document.activeElement;
      if (activeElement === document.body || menuRef.current?.contains(activeElement)) {
        focusElement(trigger.isConnected ? trigger : fallback);
      }
    });

    // จังหวะสอง บางคำสั่งลบแถวหลังเรียก API เสร็จ ซึ่งช้ากว่า rAF มาก จึงต้องเฝ้า DOM รอ
    const observer = new MutationObserver(() => {
      if (trigger.isConnected) return;
      const activeElement = document.activeElement;
      if (activeElement === document.body || !activeElement?.isConnected) focusElement(fallback);
      observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    // เลิกเฝ้าใน 2 วิ ถ้าไม่มีอะไรถูกลบ จะได้ไม่ค้างกินแรงเครื่องไปเรื่อย ๆ
    window.setTimeout(() => observer.disconnect(), 2_000);
  };

  useEffect(() => {
    // ผูก listener เฉพาะตอนเมนูเปิด ปิดแล้วไม่ต้องไปกวน event ของทั้งหน้า
    if (!isOpen) return;

    // เช็คทั้งปุ่มและตัวเมนู เพราะเมนูถูก portal ไปไว้ที่ body จึงไม่ได้อยู่ในปุ่ม
    const closeOnOutsideInteraction = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setIsOpen(false);
    };

    // Esc ปิดแล้วคืนโฟกัสให้ปุ่ม คนใช้คีย์บอร์ดจะได้ไปต่อจากจุดเดิม
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
      // ล้างตำแหน่งเก่าทิ้ง ไม่งั้นเปิดครั้งหน้าจะแวบไปโผล่ที่เดิมก่อนวัดใหม่
      setMenuStyle(undefined);
      return;
    }

    const positionMenu = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const triggerRect = trigger.getBoundingClientRect();
      const menuRect = menuRef.current?.getBoundingClientRect();
      // รอบแรกยังไม่มีเมนูให้วัด จึงเดาขนาดไว้ก่อนจากจำนวนรายการ
      const width = menuRect?.width ?? 176;
      const height = menuRect?.height ?? Math.max(56, items.length * 44 + 12);
      // เว้นขอบจอไว้ กันเมนูไปติดริมจนกดยาก
      const viewportPadding = 12;
      const gap = 8;
      const desiredLeft = align === "end" ? triggerRect.right - width : triggerRect.left;
      // หนีบค่าไว้ในจอ ไม่ให้ล้นออกไปทั้งซ้ายและขวา
      const left = Math.min(window.innerWidth - width - viewportPadding, Math.max(viewportPadding, desiredLeft));
      const below = triggerRect.bottom + gap;
      // กางลงล่างก่อน ถ้าที่ไม่พอค่อยพลิกขึ้นบน แถวท้ายตารางจะได้ไม่โดนขอบจอบัง
      const top = below + height <= window.innerHeight - viewportPadding
        ? below
        : Math.max(viewportPadding, triggerRect.top - height - gap);
      setMenuStyle({ left, top });
    };

    positionMenu();
    // รอบสองรอให้ render เสร็จก่อน จะได้วัดขนาดจริงแทนค่าที่เดาไว้ แล้วค่อยโฟกัสรายการแรก
    const frame = window.requestAnimationFrame(() => {
      positionMenu();
      menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
    });
    window.addEventListener("resize", positionMenu);
    // true = จับ scroll ของกล่องข้างในด้วย ไม่ใช่แค่ของหน้าต่าง เมนูจะได้ตามปุ่มทัน
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [align, isOpen, items.length]);

  // ลูกศรขึ้นลงเลื่อนระหว่างรายการ Home/End ไปหัวท้าย ตามมาตรฐานเมนูของ ARIA
  const moveFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isOpen || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    // ข้ามรายการที่ปิดอยู่ ไม่งั้นโฟกัสจะไปค้างบนปุ่มที่กดไม่ได้
    const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);
    if (!buttons.length) return;
    // กันหน้าเลื่อนตามลูกศรไปด้วย
    event.preventDefault();
    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex = rovingIndex(event.key, currentIndex, buttons.length);
    buttons[nextIndex]?.focus();
  };

  return (
    <div className="action-menu" ref={rootRef}>
      <IconButton
        // ชี้ไปที่เมนูเฉพาะตอนเปิดอยู่ ไม่งั้นจะชี้ไปยัง id ที่ไม่มีใน DOM
        aria-controls={isOpen ? menuId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        label={label}
        onClick={() => setIsOpen((current) => !current)}
        ref={triggerRef}
      >
        <MoreHorizontal aria-hidden="true" size={18} />
      </IconButton>
      {/* วางที่ body กัน overflow ของตารางหรือการ์ดที่ครอบอยู่มาตัดเมนูขาด */}
      {isOpen && menuStyle && typeof document !== "undefined" ? createPortal(
        <div aria-label={label} className={`action-menu-popover action-menu-${align}`} id={menuId} onKeyDown={moveFocus} ref={menuRef} role="menu" style={menuStyle}>
          {items.map((item, index) => (
            <button
              // โฟกัสรายการแรกที่กดได้ทันทีที่เปิด คนใช้คีย์บอร์ดจะได้ไม่ต้อง Tab เข้ามาเอง
              autoFocus={index === items.findIndex((candidate) => !candidate.disabled)}
              className={item.variant === "danger" ? "action-menu-danger" : undefined}
              disabled={item.disabled}
              key={item.id}
              onClick={() => {
                // เก็บปุ่มกับที่ลงสำรองไว้ก่อน เพราะคำสั่งอาจลบแถวนี้ทิ้งจนหาไม่เจอทีหลัง
                const trigger = triggerRef.current;
                const fallback = findRemovalFallback();
                setIsOpen(false);
                // ย้ายโฟกัสออกจากเมนูก่อนเมนูถูกถอด และเผื่อคำสั่งเปิดกล่องโต้ตอบ
                // กล่องนั้นจะได้มีปุ่มที่แน่นอนไว้คืนโฟกัสให้ตอนปิด
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
