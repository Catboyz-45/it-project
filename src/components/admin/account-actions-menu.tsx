/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React account-actions-menu ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";

import { KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

type MenuAction = { label: string; disabled?: boolean; onSelect: () => void };

/** สร้างส่วนหน้าจอ AccountActionsMenu; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function AccountActionsMenu({ userName, actions }: { userName: string; actions: MenuAction[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();
  const enabledIndexes = actions.flatMap((action, index) => action.disabled ? [] : [index]);

  const focusItem = (index: number) => requestAnimationFrame(() => itemRefs.current[index]?.focus());
  const openMenu = () => { setOpen(true); if (enabledIndexes.length) focusItem(enabledIndexes[0]); };
  const closeMenu = (restoreFocus = false) => { setOpen(false); if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus()); };

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeMenu(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (["Enter", " ", "ArrowDown"].includes(event.key)) { event.preventDefault(); openMenu(); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setOpen(true); if (enabledIndexes.length) focusItem(enabledIndexes.at(-1)!); }
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); closeMenu(true); return; }
    if (event.key === "Tab") { closeMenu(false); return; }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (!enabledIndexes.length) return;
    const current = itemRefs.current.findIndex(item => item === document.activeElement);
    const position = Math.max(0, enabledIndexes.indexOf(current));
    const next = event.key === "Home" ? enabledIndexes[0] : event.key === "End" ? enabledIndexes.at(-1)! : enabledIndexes[(position + (event.key === "ArrowDown" ? 1 : -1) + enabledIndexes.length) % enabledIndexes.length];
    itemRefs.current[next]?.focus();
  }

  return <div className="account-menu" ref={rootRef}>
    <button ref={triggerRef} className="icon-btn" type="button" aria-label={`เมนู ${userName}`} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={() => open ? closeMenu(false) : openMenu()} onKeyDown={handleTriggerKeyDown}><MoreHorizontal size={17} /></button>
    {open && <div className="account-menu-items" id={menuId} role="menu" aria-label={`การจัดการ ${userName}`} onKeyDown={handleMenuKeyDown}>
      {actions.map((action, index) => <button ref={element => { itemRefs.current[index] = element; }} key={action.label} type="button" role="menuitem" tabIndex={-1} disabled={action.disabled} onClick={() => { closeMenu(false); action.onSelect(); }}>{action.label}</button>)}
    </div>}
  </div>;
}
