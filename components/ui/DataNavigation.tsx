"use client";
// มี onClick ที่ผู้ใช้กด

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

// ปุ่มสองตัวในไฟล์นี้รับ prop ชุดเดียวกัน ต่างกันแค่หน้าตาและคำเริ่มต้น
type ActionProps = {
  disabled?: boolean;
  isLoading?: boolean;
  label?: string;
  // ข้อความระหว่างกำลังทำงาน กันผู้ใช้กดซ้ำเพราะคิดว่าไม่มีอะไรเกิดขึ้น
  loadingLabel?: string;
  onClick: () => void;
  className?: string;
};

// ใช้คู่กับข้อความแจ้งข้อผิดพลาด ให้ผู้ใช้ลองโหลดใหม่ได้โดยไม่ต้องรีเฟรชทั้งหน้า
export function RetryButton({
  className = "",
  disabled = false,
  isLoading = false,
  label = "ลองใหม่",
  loadingLabel = "กำลังลองใหม่...",
  onClick,
}: Readonly<ActionProps>) {
  return (
    <Button
      // trim กันช่องว่างท้ายเวลาไม่ได้ส่ง className มา
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

// ปุ่มท้ายรายการแบบแบ่งหน้าทีละชุด แทนการโหลดทั้งหมดมาทีเดียว
export function LoadMoreButton({
  className = "",
  disabled = false,
  isLoading = false,
  label = "โหลดเพิ่มเติม",
  loadingLabel = "กำลังโหลด...",
  onClick,
}: Readonly<ActionProps>) {
  return (
    // ห่อด้วย div เพราะต้องจัดปุ่มให้อยู่กลางและมีเส้นคั่นเหนือรายการ
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
