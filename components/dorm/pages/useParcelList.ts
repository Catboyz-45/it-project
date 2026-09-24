"use client";
// รายการพัสดุของหอ ตัวเลขสรุป และการแบ่งหน้าฝั่งเซิร์ฟเวอร์
// แยกจาก ParcelsPage เพราะเป็นการดึงและแปลงข้อมูลล้วน ๆ ไม่เกี่ยวกับหน้าจอ

import { useCallback, useEffect, useRef, useState } from "react";

export type ParcelSummary = { today: number; waiting: number; received: number; olderThanThreeDays: number };

// cancelled ใช้กับรายการที่ลงทะเบียนผิด ยกเลิกแล้วไม่ลบทิ้ง เพื่อให้ตรวจย้อนหลังได้
export type ParcelStatus = "waiting" | "received" | "cancelled";

// พัสดุหนึ่งชิ้น
export type ParcelRecord = {
  id: string;
  imageUrl?: string;
  note: string;
  roomId: string;
  tenantName: string;
  receivedAt?: string;
  registeredAt: string;
  status: ParcelStatus;
  // ส่งกลับไปตอนแก้ไข เซิร์ฟเวอร์จะปฏิเสธถ้ามีคนอื่นแก้ไปก่อนแล้ว กันแก้ทับกัน
  updatedAt?: string;
};

// รูปแบบที่ API ส่งกลับมา ต่างจากที่หน้าจอใช้ จึงต้องแปลงก่อน
type ParcelResponseItem = {
  id: string;
  status: "WAITING" | "RECEIVED" | "CANCELLED";
  note: string | null;
  updatedAt: string;
  registeredAt: string;
  receivedAt: string | null;
  imageUrl: string | null;
  recipientTenant: { id: string; user: { displayName: string } } | null;
  room: { number: string; occupancies: Array<{ tenantProfile: { user: { displayName: string } } }> };
};

const emptySummary: ParcelSummary = { today: 0, waiting: 0, received: 0, olderThanThreeDays: 0 };

// สถานะในฐานข้อมูลเป็นตัวพิมพ์ใหญ่ ส่วนหน้าจอใช้ตัวพิมพ์เล็ก
const statusMap: Record<ParcelResponseItem["status"], ParcelStatus> = {
  WAITING: "waiting",
  RECEIVED: "received",
  CANCELLED: "cancelled",
};

function toParcelRecord(item: ParcelResponseItem): ParcelRecord {
  return {
    id: item.id,
    imageUrl: item.imageUrl ?? undefined,
    note: item.note ?? "",
    roomId: item.room.number,
    // ไม่ได้ระบุผู้รับ แปลว่าเป็นพัสดุของห้อง ไม่ใช่ของคนใดคนหนึ่ง
    tenantName: item.recipientTenant?.user.displayName ?? "พัสดุส่วนกลางของห้อง",
    registeredAt: new Date(item.registeredAt).toLocaleString("th-TH"),
    receivedAt: item.receivedAt ? new Date(item.receivedAt).toLocaleString("th-TH") : undefined,
    status: statusMap[item.status],
    updatedAt: item.updatedAt,
  };
}

export function useParcelList({
  initialHasNextPage,
  initialParcels,
  initialSummary,
  onError,
  propertyId,
}: {
  initialHasNextPage: boolean;
  initialParcels: ParcelRecord[];
  initialSummary?: ParcelSummary | null;
  // ต้องเป็นฟังก์ชันที่ไม่เปลี่ยนตัวตนทุก render เช่น setter ของ useState
  onError: (message: string) => void;
  propertyId: string;
}) {
  const [parcels, setParcels] = useState(initialParcels);
  const [summary, setSummary] = useState(initialSummary ?? emptySummary);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [serverPage, setServerPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(initialHasNextPage);

  const loadParcels = useCallback(async (targetPage = 1, append = false) => {
    if (append) setIsLoadingMore(true);
    else setIsLoading(true);
    onError("");
    try {
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/parcels?page=${targetPage}&pageSize=50`, { cache: "no-store" });
      const payload = await response.json() as {
        data?: ParcelResponseItem[];
        error?: string;
        pageInfo?: { page: number; hasNextPage: boolean };
        summary?: ParcelSummary;
      };
      if (!response.ok || !payload.data || !payload.pageInfo) throw new Error(payload.error || "โหลดพัสดุไม่สำเร็จ");
      const mapped = payload.data.map(toParcelRecord);
      setParcels((current) => append ? [...current, ...mapped] : mapped);
      setServerPage(payload.pageInfo.page);
      setHasNextPage(payload.pageInfo.hasNextPage);
      if (payload.summary) setSummary(payload.summary);
    } catch (error) {
      onError(error instanceof Error ? error.message : "โหลดพัสดุไม่สำเร็จ");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [onError, propertyId]);

  // เซิร์ฟเวอร์ส่งรายการกับตัวเลขสรุปมาให้แล้วตั้งแต่เปิดหน้า จึงไม่ต้องยิงซ้ำ
  // ไม่ได้ส่งมา (เช่นถูกเรียกจากที่อื่น) ค่อยโหลดเองเหมือนเดิม
  const skipInitialLoadRef = useRef(initialSummary != null);
  useEffect(() => {
    if (skipInitialLoadRef.current) {
      skipInitialLoadRef.current = false;
      return;
    }
    void loadParcels();
  }, [loadParcels]);

  return { hasNextPage, isLoading, isLoadingMore, loadParcels, parcels, serverPage, summary };
}
