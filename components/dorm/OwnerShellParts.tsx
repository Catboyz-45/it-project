"use client";
// ชิ้นส่วนหน้าจอของเปลือกเจ้าของหอที่แยกออกมาจาก DormDashboard
// เพื่อให้เปลือกเหลือแค่การประกอบ ไม่ต้องถือเงื่อนไขการแสดงผลทั้งหมดไว้เอง

import Link from "next/link";
import { AlertTriangle, CreditCard, LockKeyhole } from "lucide-react";
import { RetryButton } from "@/components/ui/DataNavigation";
import type { OwnerDashboardAggregation } from "@/types/dashboard";
import type { SubscriptionUiAccessState } from "@/lib/client/subscription-access-state";
import { ownerPagePath } from "@/lib/navigation-routes";
import { isSubscriptionExpiringSoon } from "@/components/dorm/owner-notifications";

// ป้ายตัวเลขบนเมนู ซ่อนไปเลยเมื่อไม่มีอะไรค้าง
export function MenuBadge({ count, isReadOnly }: Readonly<{ count: number; isReadOnly: boolean }>) {
  if (count <= 0) return null;
  const purpose = isReadOnly ? "สำหรับตรวจสอบ" : "ที่ต้องดำเนินการ";
  return <span aria-label={`${count} รายการ${purpose}`} className="notification-badge">{count > 99 ? "99+" : count}</span>;
}

// แถบบอกสถานะสิทธิ์การใช้งานด้านบนพื้นที่ทำงาน แสดงได้ทีละกรณีเท่านั้น
// เรียงตามลำดับความเร่งด่วน ตรวจสอบอยู่ ตรวจไม่ได้ หมดอายุ ผ่อนผัน แล้วค่อยใกล้หมดอายุ
export function SubscriptionAccessBanner({
  accessState,
  aggregation,
  isInGracePeriod,
  isRefreshing,
  onRetry,
  propertyId,
}: Readonly<{
  accessState: SubscriptionUiAccessState;
  aggregation: OwnerDashboardAggregation | null;
  isInGracePeriod: boolean;
  isRefreshing: boolean;
  onRetry: () => void;
  propertyId: string;
}>) {
  if (accessState === "loading") {
    return <output className="subscription-access-banner grace">
      <span><CreditCard aria-hidden="true" /></span>
      <div>
        <strong>กำลังตรวจสอบสิทธิ์การใช้งาน</strong>
        <p>ระบบปิดการแก้ไขข้อมูลไว้ชั่วคราวระหว่างตรวจสอบสถานะแพ็กเกจ</p>
      </div>
    </output>;
  }

  if (accessState === "error") {
    return <div className="subscription-access-banner grace" role="alert">
      <span><AlertTriangle aria-hidden="true" /></span>
      <div>
        <strong>ยังตรวจสอบสิทธิ์การใช้งานไม่ได้</strong>
        <p>ระบบปิดการแก้ไขข้อมูลไว้ชั่วคราวเพื่อความปลอดภัย กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่</p>
      </div>
      <button className="primary-button" disabled={isRefreshing} onClick={onRetry} type="button">
        {isRefreshing ? "กำลังตรวจสอบ..." : "ลองตรวจสอบใหม่"}
      </button>
    </div>;
  }

  if (accessState === "read-only") {
    return <div className="subscription-access-banner read-only" role="alert">
      <span><LockKeyhole aria-hidden="true" /></span>
      <div>
        <strong>พื้นที่นี้อยู่ในโหมดอ่านอย่างเดียว</strong>
        <p>ยังดู ค้นหา และดาวน์โหลดข้อมูลเดิมได้ แต่ไม่สามารถเพิ่ม แก้ไข อนุมัติ หรือสร้างรายการใหม่</p>
      </div>
      <Link className="primary-button" href={ownerPagePath(propertyId, "subscription")}>ต่ออายุแพ็กเกจ</Link>
    </div>;
  }

  const subscription = aggregation?.subscription;
  if (!subscription) return null;

  if (isInGracePeriod) {
    const graceEndsAt = subscription.graceEndsAt;
    return <output className="subscription-access-banner grace">
      <span><CreditCard aria-hidden="true" /></span>
      <div>
        <strong>อยู่ในช่วงผ่อนผันหลังแพ็กเกจหมดอายุ</strong>
        <p>
          ยังแก้ไขข้อมูลได้ถึง {graceEndsAt ? new Date(graceEndsAt).toLocaleDateString("th-TH") : "-"} หลังจากนั้นระบบจะเปลี่ยนเป็นโหมดอ่านอย่างเดียว
        </p>
      </div>
      <Link className="primary-button" href={ownerPagePath(propertyId, "subscription")}>ต่ออายุแพ็กเกจ</Link>
    </output>;
  }

  if (isSubscriptionExpiringSoon(aggregation)) {
    // block เพราะ output เป็น inline โดยค่าเริ่มต้น แต่แถบนี้ต้องกินความกว้างเต็มแถว
    return <output className="form-alert block">
      แพ็กเกจ {subscription.planName} ใกล้หมดอายุวันที่ {new Date(subscription.expiresAt).toLocaleDateString("th-TH")}
      {" · "}<Link href={ownerPagePath(propertyId, "subscription")}>ตรวจสอบและต่ออายุ</Link>
    </output>;
  }

  return null;
}

// แถบแจ้งข้อผิดพลาดของข้อมูลร่วม พร้อมปุ่มลองใหม่
export function WorkspaceDataError({ message, onRetry }: Readonly<{ message: string; onRetry: () => void }>) {
  if (!message) return null;
  return <div className="form-alert error" role="alert"><span>{message}</span><RetryButton onClick={onRetry} /></div>;
}
