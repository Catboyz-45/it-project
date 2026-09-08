"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Data Navigation” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Action Props” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type ActionProps = {
  disabled?: boolean;
  isLoading?: boolean;
  label?: string;
  loadingLabel?: string;
  onClick: () => void;
  className?: string;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Retry Button” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { className = "", disabled = false, isLoading = false, label: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function RetryButton({
  className = "",
  disabled = false,
  isLoading = false,
  label = "ลองใหม่",
  loadingLabel = "กำลังลองใหม่...",
  onClick,
}: ActionProps) {
  return (
    <Button
      className={`data-action data-action-retry ${className}`.trim()}
      disabled={disabled}
      isLoading={isLoading}
      loadingLabel={loadingLabel}
      onClick={onClick}
      size="sm"
      variant="secondary"
    >
      <RefreshCw aria-hidden="true" size={16} /> {label}
    </Button>
  );
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Load More Button” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { className = "", disabled = false, isLoading = false, label: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function LoadMoreButton({
  className = "",
  disabled = false,
  isLoading = false,
  label = "โหลดเพิ่มเติม",
  loadingLabel = "กำลังโหลด...",
  onClick,
}: ActionProps) {
  return (
    <div className={`data-load-more ${className}`.trim()}>
      <Button
        className="data-action data-action-load-more"
        disabled={disabled}
        isLoading={isLoading}
        loadingLabel={loadingLabel}
        onClick={onClick}
        variant="secondary"
      >
        {label}
      </Button>
    </div>
  );
}
