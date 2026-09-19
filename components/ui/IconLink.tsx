"use client";
// วัดตำแหน่งจาก DOM และฟัง event ของหน้าต่าง

import { forwardRef, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AnchorHTMLAttributes, CSSProperties, ReactNode } from "react";
import type { IconButtonSize, IconButtonVariant } from "@/components/ui/IconButton";

// ตัด aria-label ออกแล้วบังคับ label แทน เพราะลิงก์ไอคอนไม่มีข้อความให้อ่าน
export type IconLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "aria-label" | "children"> & {
  children: ReactNode;
  label: string;
  size?: IconButtonSize;
  // ข้อความบนคำแนะนำ ถ้าไม่ส่งจะใช้ label เดียวกัน
  tooltip?: string;
  variant?: IconButtonVariant;
};

// เหมือน IconButton แต่เป็นลิงก์ ใช้ตอนกดแล้วต้องเปลี่ยนหน้าหรือเปิดไฟล์
export const IconLink = forwardRef<HTMLAnchorElement, IconLinkProps>(function IconLink({
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
  variant = "default",
  ...props
}, ref) {
  const tooltipText = tooltip ?? label;
  // id เฉพาะตัว เพราะหน้าหนึ่งมีลิงก์ไอคอนหลายอัน แต่ละอันต้องชี้คำแนะนำของตัวเอง
  const tooltipId = useId();
  const linkRef = useRef<HTMLAnchorElement | null>(null);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>();

  // เก็บ ref ไว้ใช้วัดตำแหน่งเอง พร้อมส่งต่อให้ผู้เรียกที่ขอ ref มาด้วย
  // ต้องรองรับทั้งแบบฟังก์ชันและแบบ object เพราะ React มีสองรูปแบบ
  const assignRef = (node: HTMLAnchorElement | null) => {
    linkRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };

  useEffect(() => {
    if (!isTooltipVisible) return;
    let frameId = 0;

    const updatePosition = () => {
      const link = linkRef.current;
      if (!link) return;
      const rect = link.getBoundingClientRect();
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
      setTooltipStyle(rect.top < 64
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
        const showBelow = rect.top < tooltipRect.height + viewportPadding + 12;
        setTooltipStyle(showBelow
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
      <a
        {...props}
        // ชี้ไปที่คำแนะนำเฉพาะตอนแสดงอยู่ ไม่งั้นจะชี้ไปยัง id ที่ไม่มีใน DOM
        aria-describedby={isTooltipVisible ? tooltipId : undefined}
        aria-label={label}
        className={`icon-button icon-button-${size} icon-button-${variant} ${className}`.trim()}
        // แสดงทั้งตอนเมาส์ชี้และตอนโฟกัสด้วยคีย์บอร์ด ไม่งั้นคนที่ใช้ Tab จะไม่เห็นคำแนะนำเลย
        onBlur={(event) => {
          setIsTooltipVisible(false);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setIsTooltipVisible(true);
          onFocus?.(event);
        }}
        // Esc ปิดคำแนะนำโดยไม่ต้องย้ายโฟกัสออก
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
      >
        {children}
      </a>
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
