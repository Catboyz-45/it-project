"use client";
// วัดตำแหน่งจาก DOM และฟัง event ของหน้าต่าง

import { forwardRef, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

// default = ปุ่มทั่วไป primary = การกระทำหลัก danger = การกระทำที่ย้อนกลับไม่ได้
export type IconButtonVariant = "default" | "primary" | "danger";

// คุมทั้งขนาดปุ่มและพื้นที่กด md เป็นค่าเริ่มต้นที่ใช้มากที่สุด
export type IconButtonSize = "sm" | "md" | "lg";

// ตัด aria-label ออกแล้วบังคับ label แทน เพราะปุ่มไอคอนไม่มีข้อความให้อ่าน
export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> & {
  children: ReactNode;
  label: string;
  size?: IconButtonSize;
  // ข้อความบนคำแนะนำ ถ้าไม่ส่งจะใช้ label เดียวกัน
  tooltip?: string;
  variant?: IconButtonVariant;
};

// กวาดเมาส์ผ่านแถวปุ่มไอคอนแล้วคำแนะนำจะเด้งทีละอันจนตาลาย รอ 50ms ก่อนค่อยแสดง
// เท่ากับ delayDuration ของ Cal.com ซึ่งสั้นพอที่จะยังรู้สึกว่าขึ้นทันทีเมื่อตั้งใจชี้จริง
const tooltipHoverDelayMs = 50;

// ปุ่มไอคอนพร้อมคำแนะนำ ใช้ตอนที่ไอคอนอย่างเดียวยังสื่อความหมายไม่ชัดพอ
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
  // ตั้ง button เป็นค่าเริ่มต้น กัน submit ฟอร์มโดยไม่ตั้งใจ
  type = "button",
  variant = "default",
  ...props
}, ref) {
  const tooltipText = tooltip ?? label;
  // id เฉพาะตัว เพราะหน้าหนึ่งมีปุ่มไอคอนหลายอัน แต่ละอันต้องชี้คำแนะนำของตัวเอง
  const tooltipId = useId();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ยกเลิกตัวจับเวลาที่ยังค้าง ใช้ทั้งตอนเมาส์ออกและตอนถอดคอมโพเนนต์
  const cancelHoverTimer = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = null;
  };
  useEffect(() => cancelHoverTimer, []);
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>();

  // เก็บ ref ไว้ใช้วัดตำแหน่งเอง พร้อมส่งต่อให้ผู้เรียกที่ขอ ref มาด้วย
  // ต้องรองรับทั้งแบบฟังก์ชันและแบบ object เพราะ React มีสองรูปแบบ
  const assignRef = (node: HTMLButtonElement | null) => {
    buttonRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };

  useEffect(() => {
    if (!isTooltipVisible) return;
    let frameId = 0;

    const updatePosition = () => {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      // เว้นขอบจอไว้ กันคำแนะนำไปติดริมจนอ่านไม่ออก
      const viewportPadding = 12;

      // รอบแรกเดาความกว้างจากจำนวนตัวอักษร เพราะยังไม่ได้ render จึงวัดจริงไม่ได้
      // ทำไปก่อนเพื่อไม่ให้คำแนะนำโผล่ที่มุมซ้ายบนแล้วค่อยกระโดดมาตำแหน่งถูก
      const estimatedHalfWidth = Math.min(112, Math.max(42, tooltipText.length * 4.5));
      const center = rect.left + rect.width / 2;
      // หนีบค่าไว้ในจอ ไม่ให้ล้นออกไปทั้งซ้ายและขวา
      const left = Math.min(
        window.innerWidth - viewportPadding - estimatedHalfWidth,
        Math.max(viewportPadding + estimatedHalfWidth, center),
      );
      // อยู่ใกล้ขอบบนเกินไปก็วางไว้ข้างล่างแทน
      const showBelow = rect.top < 64;

      setTooltipStyle(showBelow
        ? { left, top: rect.bottom + 12, transform: "translateX(-50%)" }
        : { bottom: window.innerHeight - rect.top + 12, left, transform: "translateX(-50%)" });

      window.cancelAnimationFrame(frameId);
      // รอบสองรอให้ render เสร็จก่อน แล้ววัดความกว้างจริงมาแก้ตำแหน่งให้แม่น
      frameId = window.requestAnimationFrame(() => {
        const renderedTooltip = tooltipRef.current;
        if (!renderedTooltip) return;
        const tooltipRect = renderedTooltip.getBoundingClientRect();
        const halfWidth = tooltipRect.width / 2;
        const measuredLeft = Math.min(
          window.innerWidth - viewportPadding - halfWidth,
          Math.max(viewportPadding + halfWidth, center),
        );
        // คราวนี้รู้ความสูงจริงแล้ว จึงตัดสินได้ว่าข้างบนมีที่พอไหม
        const measuredShowBelow = rect.top < tooltipRect.height + viewportPadding + 12;
        setTooltipStyle(measuredShowBelow
          ? { left: measuredLeft, top: rect.bottom + 12, transform: "translateX(-50%)" }
          : { bottom: window.innerHeight - rect.top + 12, left: measuredLeft, transform: "translateX(-50%)" });
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    // true = จับ scroll ของกล่องข้างในด้วย ไม่ใช่แค่ของหน้าต่าง คำแนะนำจะได้ตามทัน
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
        // ชี้ไปที่คำแนะนำเฉพาะตอนแสดงอยู่ ไม่งั้นจะชี้ไปยัง id ที่ไม่มีใน DOM
        aria-describedby={isTooltipVisible ? tooltipId : undefined}
        aria-label={label}
        className={`icon-button icon-button-${size} icon-button-${variant} ${className}`.trim()}
        // แสดงทั้งตอนเมาส์ชี้และตอนโฟกัสด้วยคีย์บอร์ด ไม่งั้นคนที่ใช้ Tab จะไม่เห็นคำแนะนำเลย
        onBlur={(event) => {
          cancelHoverTimer();
          setIsTooltipVisible(false);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          cancelHoverTimer();
          setIsTooltipVisible(true);
          onFocus?.(event);
        }}
        // Esc ปิดคำแนะนำโดยไม่ต้องย้ายโฟกัสออก
        onKeyDown={(event) => {
          if (event.key === "Escape") setIsTooltipVisible(false);
          onKeyDown?.(event);
        }}
        onMouseEnter={(event) => {
          cancelHoverTimer();
          hoverTimerRef.current = setTimeout(() => setIsTooltipVisible(true), tooltipHoverDelayMs);
          onMouseEnter?.(event);
        }}
        onMouseLeave={(event) => {
          cancelHoverTimer();
          setIsTooltipVisible(false);
          onMouseLeave?.(event);
        }}
        ref={assignRef}
        type={type}
      >
        {children}
      </button>
      {/* วางที่ body กัน overflow ของตารางหรือการ์ดที่ครอบอยู่มาตัดคำแนะนำขาด */}
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
