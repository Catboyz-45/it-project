"use client";
// ถือข้อมูลร่วมของพื้นที่เจ้าของหอและจัดการการโหลดใหม่ แยกออกจาก DormDashboard
// เพื่อให้เปลือกเหลือหน้าที่ประกอบหน้าจออย่างเดียว ตามหลักไม่เอา logic ไว้ในคอมโพเนนต์

import { useCallback, useState } from "react";
import type { Invoice, Room, Tenant } from "@/types/dorm";
import type { OwnerDashboardAggregation, OwnerWorkspaceReadModel } from "@/types/dashboard";

// ดึง JSON จาก API ที่ห่อคำตอบไว้ใน data โยน error เมื่อไม่สำเร็จ
// เพื่อให้ Promise.allSettled แยกได้ว่าชุดไหนพัง
async function loadJson<T>(url: string, fallbackMessage: string) {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  const payload = await response.json() as { data?: T; error?: string };
  if (!response.ok || payload.data === undefined || payload.data === null) {
    throw new Error(payload.error || fallbackMessage);
  }
  return payload.data;
}

// ข้อความจาก reason ของ Promise ที่ถูกปฏิเสธ ซึ่งเป็น unknown เสมอ
function errorMessageOf(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

export function useOwnerWorkspaceData({
  initialAggregation,
  initialData,
  propertyId,
}: {
  initialAggregation: OwnerDashboardAggregation;
  initialData: OwnerWorkspaceReadModel;
  propertyId: string;
}) {
  const [rooms, setRooms] = useState<Room[]>(initialData.rooms);
  const [tenants, setTenants] = useState<Tenant[]>(initialData.tenants);
  const [invoices, setInvoices] = useState<Invoice[]>(initialData.invoices);
  const [repairTickets, setRepairTickets] = useState(initialData.repairs);
  const [dashboardData, setDashboardData] = useState(initialData);
  const [aggregation, setAggregation] = useState<OwnerDashboardAggregation | null>(initialAggregation);
  const [dataError, setDataError] = useState("");
  const [accessError, setAccessError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // โหลดข้อมูลร่วมใหม่ทั้งชุด เรียกหลังทุกการแก้ไข เพื่อให้ทุกหน้าเห็นข้อมูลตรงกัน
  // ใช้ allSettled เพราะข้อมูลสรุปกับข้อมูลหลักมาคนละคำสั่ง ชุดหนึ่งพังอีกชุดควรยังใช้ได้
  const refreshDashboard = useCallback(async () => {
    setIsRefreshing(true);
    setDataError("");
    setAccessError("");
    const [workspaceResult, aggregationResult] = await Promise.allSettled([
      loadJson<OwnerWorkspaceReadModel>(`/api/v1/admin/properties/${propertyId}/dashboard`, "โหลดข้อมูลหอพักไม่สำเร็จ"),
      loadJson<OwnerDashboardAggregation>(`/api/v1/admin/properties/${propertyId}/dashboard/summary`, "โหลดข้อมูลสรุปไม่สำเร็จ"),
    ]);
    const errors: string[] = [];

    if (workspaceResult.status === "fulfilled") {
      const workspace = workspaceResult.value;
      setDashboardData(workspace);
      setRooms(workspace.rooms);
      setTenants(workspace.tenants);
      setInvoices(workspace.invoices);
      setRepairTickets(workspace.repairs);
    } else {
      errors.push(errorMessageOf(workspaceResult.reason, "โหลดข้อมูลหอพักไม่สำเร็จ"));
    }

    if (aggregationResult.status === "fulfilled") {
      setAggregation(aggregationResult.value);
    } else {
      setAggregation(null);
      // เก็บแยกไว้ด้วย เพราะสถานะสิทธิ์การใช้งานคิดจากข้อมูลสรุปชุดนี้ชุดเดียว
      const aggregationError = errorMessageOf(aggregationResult.reason, "โหลดข้อมูลสรุปไม่สำเร็จ");
      setAccessError(aggregationError);
      errors.push(aggregationError);
    }

    setDataError(errors.join(" · "));
    setIsRefreshing(false);
  }, [propertyId]);

  return {
    accessError,
    aggregation,
    dashboardData,
    dataError,
    invoices,
    isRefreshing,
    refreshDashboard,
    repairTickets,
    rooms,
    setDataError,
    setTenants,
    tenants,
  };
}
