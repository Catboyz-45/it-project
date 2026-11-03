"use client";

import { ChevronDown } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ColorOption = { label: string; value: string };

const gridColumns = 8;

// ปุ่มสีแบบ Word: กดตัวปุ่มใส่สีล่าสุดทันที ลูกศรข้าง ๆ เปิดตารางสีสำเร็จรูป
// ทุกปุ่มกันไม่ให้แย่งโฟกัสตอนกด ข้อความที่เลือกไว้ในเอกสารจะได้ไม่หลุด
export function ColorMenu({ clearLabel, colors, icon, label, lastColor, onApply }: Readonly<{
  clearLabel: string;
  colors: ColorOption[];
  icon: ReactNode;
  label: string;
  lastColor: string;
  // null คือเอาสีออก
  onApply: (color: string | null) => void;
}>) {
  const [isOpen, setIsOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>();
  const popoverId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const lastColorName = colors.find((color) => color.value === lastColor)?.label ?? lastColor;
  const keepSelection = (event: React.MouseEvent) => event.preventDefault();

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popoverRef.current?.contains(target)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      toggleRef.current?.focus();
    };
    // วางใต้ปุ่ม หนีบไว้ในจอ แถบเครื่องมือเลื่อนซ้ายขวาได้บนจอเล็ก ตำแหน่งจึงต้องตามปุ่มตลอด
    const position = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = popoverRef.current?.offsetWidth ?? 256;
      setPopoverStyle({ left: Math.max(12, Math.min(window.innerWidth - width - 12, rect.left)), top: rect.bottom + 6 });
    };
    position();
    const frame = window.requestAnimationFrame(() => {
      position();
      popoverRef.current?.querySelector<HTMLButtonElement>("[aria-pressed='true'], .template-color-swatch")?.focus({ preventScroll: true });
    });
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [isOpen]);

  const choose = (color: string | null) => {
    onApply(color);
    setIsOpen(false);
  };

  // ลูกศรเลื่อนในตารางสี ซ้ายขวาทีละช่อง ขึ้นลงทีละแถว
  const moveInGrid = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -gridColumns, ArrowDown: gridColumns };
    if (!(event.key in steps)) return;
    const swatches = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
    const index = swatches.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    swatches[Math.max(0, Math.min(swatches.length - 1, index + steps[event.key]))]?.focus();
  };

  return (
    <div className="template-color-menu" ref={rootRef}>
      <button
        aria-label={`${label} (${lastColorName})`}
        className="template-color-apply"
        onClick={() => onApply(lastColor)}
        onMouseDown={keepSelection}
        title={`${label}: ${lastColorName}`}
        type="button"
      >
        {icon}
        <span aria-hidden="true" className="template-color-bar" style={{ background: lastColor }} />
      </button>
      <button
        aria-controls={isOpen ? popoverId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={`เลือก${label}`}
        className="template-color-toggle"
        onClick={() => setIsOpen((current) => !current)}
        onMouseDown={keepSelection}
        ref={toggleRef}
        type="button"
      >
        <ChevronDown aria-hidden="true" size={13} />
      </button>
      {isOpen && popoverStyle && typeof document !== "undefined" ? createPortal(
        <div aria-label={label} className="template-color-popover" id={popoverId} ref={popoverRef} role="dialog" style={popoverStyle}>
          <button className="template-color-clear" onClick={() => choose(null)} onMouseDown={keepSelection} type="button">
            <span aria-hidden="true" className="template-color-none" /> {clearLabel}
          </button>
          <div aria-label="สีสำเร็จรูป" className="template-color-grid" onKeyDown={moveInGrid} role="group">
            {colors.map((color) => (
              <button
                aria-label={color.label}
                aria-pressed={color.value === lastColor}
                className="template-color-swatch"
                key={color.value}
                onClick={() => choose(color.value)}
                onMouseDown={keepSelection}
                style={{ background: color.value }}
                title={color.label}
                type="button"
              />
            ))}
          </div>
          {/* ช่องเลือกสีของระบบไว้เป็นทางเลือกสุดท้าย ลากเลือกได้ทุกสี */}
          <label className="template-color-custom">
            <input aria-label={`${label}อื่น`} onChange={(event) => onApply(event.target.value)} type="color" value={lastColor} />
            สีอื่น…
          </label>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
