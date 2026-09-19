"use client";
// ตัวโหลดรายการหน้าถัดไป รายการหน้าแรกถูก render มาจากเซิร์ฟเวอร์แล้ว
// ตัวนี้จึงดูแลเฉพาะของที่กดโหลดเพิ่ม ผู้ใช้ส่วนใหญ่ไม่กดก็ไม่ต้องรันอะไรเลย
//
// แยกเป็น island ต่อชนิดรายการ ไม่ใช้ render prop เพราะส่งฟังก์ชันข้ามจาก
// Server Component มายัง Client Component ไม่ได้ ฟังก์ชันส่งผ่าน RSC ไม่ได้

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { LiveAnnouncement } from "@/components/ui/LiveAnnouncement";
import { AnnouncementCard, type TenantAnnouncement } from "@/components/tenant/AnnouncementCard";
import { ParcelCard, type TenantParcel } from "@/components/tenant/ParcelViews";

function useLoadMore<T>(url: string, pageSize: number, initialHasNextPage: boolean) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(initialHasNextPage);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const loadMore = async () => {
    setIsLoading(true);
    setError("");
    try {
      // บาง URL มีพารามิเตอร์มาแล้ว ต้องเลือกตัวคั่นให้ถูก
      const separator = url.includes("?") ? "&" : "?";
      const response = await fetch(`${url}${separator}page=${page + 1}&pageSize=${pageSize}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = await response.json() as { data?: T[]; error?: string; pageInfo?: { hasNextPage: boolean; page: number } };
      if (!response.ok || !payload.data || !payload.pageInfo) throw new Error(payload.error || "โหลดข้อมูลไม่สำเร็จ");
      setItems((current) => [...current, ...payload.data!]);
      setPage(payload.pageInfo.page);
      setHasNextPage(payload.pageInfo.hasNextPage);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setIsLoading(false);
    }
  };
  return { error, hasNextPage, isLoading, items, loadMore };
}

function LoadMoreFooter({
  error, hasNextPage, initialCount, isLoading, loadMore, shownCount,
}: {
  error: string; hasNextPage: boolean; initialCount: number; isLoading: boolean;
  loadMore: () => void; shownCount: number;
}) {
  return <>
    {/* บอกจำนวนรวมให้โปรแกรมอ่านหน้าจอ นับรวมของที่เซิร์ฟเวอร์ส่งมาด้วย */}
    <LiveAnnouncement message={isLoading
      ? "กำลังโหลดรายการเพิ่มเติม"
      : `กำลังแสดง ${(initialCount + shownCount).toLocaleString("th-TH")} รายการ${hasNextPage ? " และยังมีรายการเพิ่มเติม" : ""}`} />
    {error ? <p className="form-alert error" role="alert">{error}</p> : null}
    {hasNextPage ? (
      <button className="secondary-button mx-auto" disabled={isLoading} onClick={loadMore} type="button">
        {isLoading ? <><LoaderCircle className="animate-spin" size={17} /> กำลังโหลด...</> : "โหลดรายการเพิ่มเติม"}
      </button>
    ) : null}
  </>;
}

export function LoadMoreAnnouncements({ initialCount, initialHasNextPage, pageSize = 20 }: {
  initialCount: number; initialHasNextPage: boolean; pageSize?: number;
}) {
  const state = useLoadMore<TenantAnnouncement>("/api/v1/tenant/announcements", pageSize, initialHasNextPage);
  return <>
    {state.items.map((item) => <AnnouncementCard key={item.id} {...item} />)}
    <LoadMoreFooter {...state} initialCount={initialCount} shownCount={state.items.length} />
  </>;
}

export function LoadMoreParcels({ initialCount, initialHasNextPage, pageSize = 20 }: {
  initialCount: number; initialHasNextPage: boolean; pageSize?: number;
}) {
  const state = useLoadMore<TenantParcel>("/api/v1/tenant/parcels?view=current", pageSize, initialHasNextPage);
  return <>
    {state.items.map((item) => <ParcelCard key={item.id} {...item} />)}
    <LoadMoreFooter {...state} initialCount={initialCount} shownCount={state.items.length} />
  </>;
}
