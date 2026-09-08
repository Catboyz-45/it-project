"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Icon Button” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { forwardRef, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Icon Button Variant” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type IconButtonVariant = "default" | "primary" | "danger";
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Icon Button Size” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type IconButtonSize = "sm" | "md" | "lg";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Icon Button Props” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> & {
  children: ReactNode;
  label: string;
  size?: IconButtonSize;
  tooltip?: string;
  variant?: IconButtonVariant;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Icon Button” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { children, className = "", label, onBlur, onFocus, onKeyDow: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * - ref: ค่า “ref” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({
  children,
  className = "",
  label,
  onBlur,
  onFocus,
  onKeyDown,
  onMouseEnter,
  onMouseLeave,
  size = "md",
  tooltip,
  type = "button",
  variant = "default",
  ...props
}, ref) {
  const tooltipText = tooltip ?? label;
  const tooltipId = useId();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>();

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “assign Ref” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - node: ค่า “node” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const assignRef = (node: HTMLButtonElement | null) => {
    buttonRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };

  useEffect(() => {
    if (!isTooltipVisible) return;
    let frameId = 0;

    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “update Position” โดยใช้ค่าที่รับเข้ามา
     * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
    const updatePosition = () => {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const viewportPadding = 12;
      const estimatedHalfWidth = Math.min(112, Math.max(42, tooltipText.length * 4.5));
      const center = rect.left + rect.width / 2;
      const left = Math.min(
        window.innerWidth - viewportPadding - estimatedHalfWidth,
        Math.max(viewportPadding + estimatedHalfWidth, center),
      );
      const showBelow = rect.top < 64;

      setTooltipStyle(showBelow
        ? { left, top: rect.bottom + 12, transform: "translateX(-50%)" }
        : { bottom: window.innerHeight - rect.top + 12, left, transform: "translateX(-50%)" });

      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const renderedTooltip = tooltipRef.current;
        if (!renderedTooltip) return;
        const tooltipRect = renderedTooltip.getBoundingClientRect();
        const halfWidth = tooltipRect.width / 2;
        const measuredLeft = Math.min(
          window.innerWidth - viewportPadding - halfWidth,
          Math.max(viewportPadding + halfWidth, center),
        );
        const measuredShowBelow = rect.top < tooltipRect.height + viewportPadding + 12;
        setTooltipStyle(measuredShowBelow
          ? { left: measuredLeft, top: rect.bottom + 12, transform: "translateX(-50%)" }
          : { bottom: window.innerHeight - rect.top + 12, left: measuredLeft, transform: "translateX(-50%)" });
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isTooltipVisible, tooltipText]);

  return (
    <>
      <button
        {...props}
        aria-describedby={isTooltipVisible ? tooltipId : undefined}
        aria-label={label}
        className={`icon-button icon-button-${size} icon-button-${variant} ${className}`.trim()}
        onBlur={(event) => {
          setIsTooltipVisible(false);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setIsTooltipVisible(true);
          onFocus?.(event);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setIsTooltipVisible(false);
          onKeyDown?.(event);
        }}
        onMouseEnter={(event) => {
          setIsTooltipVisible(true);
          onMouseEnter?.(event);
        }}
        onMouseLeave={(event) => {
          setIsTooltipVisible(false);
          onMouseLeave?.(event);
        }}
        ref={assignRef}
        type={type}
      >
        {children}
      </button>
      {isTooltipVisible && tooltipStyle && typeof document !== "undefined"
        ? createPortal(
          <span className="icon-tooltip" id={tooltipId} ref={tooltipRef} role="tooltip" style={tooltipStyle}>
            {tooltipText}
          </span>,
          document.body,
        )
        : null}
    </>
  );
});
