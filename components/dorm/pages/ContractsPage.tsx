"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Contracts Page” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FilePlus2,
  FileText,
  Pencil,
  Plus,
  Search,
  Settings2,
  Upload,
  X,
} from "lucide-react";
import type { LeaseStatus } from "@/lib/domain/enums";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { leaseStatusTransitions } from "@/lib/domain/enums";
import { currency } from "@/lib/dorm-utils";
import type { Room } from "@/types/dorm";
import { ServerTablePagination, type ServerPageInfo } from "@/components/dorm/TablePagination";
import { createApiError, formatClientError, readApiData } from "@/lib/client/api-error";
import { ReadOnlyNotice } from "@/components/dorm/ReadOnlyNotice";
import { useConfirmation } from "@/components/ui/use-confirmation";
import { IconButton } from "@/components/ui/IconButton";
import { Dialog } from "@/components/ui/Dialog";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { DropdownField } from "@/components/dorm/DropdownField";
import { SearchEmptyState } from "@/components/ui/SearchEmptyState";
import { LEASE_EXPIRY_NOTICE_DAYS, leaseDisplayStatus } from "@/lib/domain/lease-expiry";
import { LiveAnnouncement } from "@/components/ui/LiveAnnouncement";
import { useActionFeedback } from "@/lib/client/use-action-feedback";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Lease” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Lease = {
  id: string;
  leaseNumber: string;
  status: LeaseStatus;
  startDate: string;
  endDate: string;
  monthlyRent: string;
  depositAmount: string;
  currentVersion: number;
  signedStorageKey: string | null;
  activatedAt: string | null;
  endedAt: string | null;
  room: { id: string; number: string };
  tenants: Array<{
    isPrimary: boolean;
    occupancy: {
      tenantProfile: {
        id: string;
        user: { displayName: string; email: string };
      };
    };
  }>;
  versions: Array<{
    id: string;
    version: number;
    documentId: string | null;
    signedStorageKey: string | null;
    createdAt: string;
  }>;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Lease Form” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type LeaseForm = {
  roomId: string;
  startDate: string;
  endDate: string;
  monthlyRent: string;
  depositAmount: string;
};

const statusLabels: Record<LeaseStatus, string> = {
  DRAFT: "ฉบับร่าง",
  PENDING_SIGNATURE: "รอลงนาม",
  ACTIVE: "ใช้งาน",
  EXPIRING: "ใกล้หมดอายุ",
  EXPIRED: "หมดอายุ",
  CANCELLED: "ยกเลิก",
};

const transitionLabels: Partial<Record<LeaseStatus, string>> = {
  DRAFT: "กลับเป็นฉบับร่าง",
  PENDING_SIGNATURE: "ส่งไปรอลงนาม",
  ACTIVE: "เปิดใช้สัญญา",
  EXPIRED: "ปิดสัญญาเป็นหมดอายุ",
  CANCELLED: "ยกเลิกสัญญา",
};

const emptyForm: LeaseForm = {
  roomId: "",
  startDate: "",
  endDate: "",
  monthlyRent: "",
  depositAmount: "",
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “date Input” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function dateInput(value: string) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “date Display” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function dateDisplay(value: string) {
  return new Date(value).toLocaleDateString("th-TH");
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “renewal Dates” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - endDate: ค่า “end Date” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function renewalDates(endDate: string) {
  const start = new Date(endDate);
  start.setUTCDate(start.getUTCDate() + 1);
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  end.setUTCDate(end.getUTCDate() - 1);
  return { startDate: dateInput(start.toISOString()), endDate: dateInput(end.toISOString()) };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “response Data” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - response: ผลตอบกลับ HTTP ที่กำลังจัดเตรียม
 * ผลลัพธ์: คืนข้อมูลชนิด Promise<T> ตามสัญญา TypeScript ของฟังก์ชัน
 */
async function responseData<T>(response: Response): Promise<T> {
  return readApiData<T>(response, "ดำเนินการไม่สำเร็จ");
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Contracts Page” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { propertyId, readOnly = false, rooms }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function ContractsPage({ propertyId, readOnly = false, rooms }: { propertyId: string; readOnly?: boolean; rooms: Room[] }) {
  const searchParams = useSearchParams();
  const moveRoomDraftHandled = useRef(false);
  const signedDocumentInputs = useRef(new Map<string, HTMLInputElement>());
  const [leases, setLeases] = useState<Lease[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [pageInfo, setPageInfo] = useState<ServerPageInfo>({ page: 1, pageSize: 20, hasNextPage: false });
  const [isSaving, setIsSaving] = useState(false);
  const actionFeedback = useActionFeedback();
  const [editingLease, setEditingLease] = useState<Lease | null>(null);
  const [renewingLease, setRenewingLease] = useState<Lease | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState<LeaseForm>(emptyForm);
  const { confirm, confirmationDialog } = useConfirmation();

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “load Leases” แล้วส่งผลที่เหมาะสมกลับไป
   * รับค่า:
   * - targetPage: ค่า “target Page” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - signal: ค่า “signal” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const loadLeases = useCallback(async (targetPage = 1, signal?: AbortSignal) => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/leases?page=${targetPage}&pageSize=20&query=${encodeURIComponent(query.trim())}`, {
        cache: "no-store",
        credentials: "same-origin",
        signal,
      });
      const payload = await response.json() as {
        data?: Lease[];
        error?: string;
        requestId?: string;
        pageInfo?: ServerPageInfo;
      };
      if (!response.ok || !payload.data || !payload.pageInfo) throw createApiError(payload, "โหลดสัญญาไม่สำเร็จ");
      setLeases(payload.data);
      setPageInfo(payload.pageInfo);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(formatClientError(loadError, "โหลดสัญญาไม่สำเร็จ"));
    } finally {
      setIsLoading(false);
    }
  }, [propertyId, query]);

  useEffect(() => {
    const controller = new AbortController();
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “timeout” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
    const timeout = window.setTimeout(() => void loadLeases(1, controller.signal), 250);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [loadLeases]);


  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “counts” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const counts = useMemo(() => ({
    active: leases.filter((lease) => leaseDisplayStatus(lease.status, lease.endDate) === "ACTIVE").length,
    pending: leases.filter((lease) => ["DRAFT", "PENDING_SIGNATURE"].includes(lease.status)).length,
    expiring: leases.filter((lease) => leaseDisplayStatus(lease.status, lease.endDate) === "EXPIRING").length,
  }), [leases]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “occupied Rooms” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - room: ค่า “room” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const occupiedRooms = rooms.filter((room) => room.status === "occupied" && room.databaseId);

  useEffect(() => {
    if (readOnly || moveRoomDraftHandled.current) return;
    const roomId = searchParams.get("createLeaseForRoom");
    if (!roomId) return;
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “room” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - item: ค่า “item” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
    const room = occupiedRooms.find((item) => item.databaseId === roomId);
    if (!room) return;

    const startDate = searchParams.get("startDate") || new Date().toISOString().slice(0, 10);
    const endDate = new Date(`${startDate}T00:00:00.000Z`);
    endDate.setUTCFullYear(endDate.getUTCFullYear() + 1);
    endDate.setUTCDate(endDate.getUTCDate() - 1);
    moveRoomDraftHandled.current = true;
    setEditingLease(null);
    setRenewingLease(null);
    setForm({
      roomId,
      startDate,
      endDate: dateInput(endDate.toISOString()),
      monthlyRent: searchParams.get("monthlyRent") || String(room.rent),
      depositAmount: searchParams.get("depositAmount") || "",
    });
    setError("");
    setIsCreateOpen(true);
    window.history.replaceState(window.history.state, "", window.location.pathname);
  }, [occupiedRooms, readOnly, searchParams]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “open Create” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const openCreate = () => {
    const room = occupiedRooms[0];
    setEditingLease(null);
    setRenewingLease(null);
    setForm({
      ...emptyForm,
      roomId: room?.databaseId ?? "",
      monthlyRent: room ? String(room.rent) : "",
      depositAmount: "",
    });
    setError("");
    setIsCreateOpen(true);
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “open Edit” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - lease: ค่า “lease” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const openEdit = (lease: Lease) => {
    setRenewingLease(null);
    setEditingLease(lease);
    setForm({
      roomId: lease.room.id,
      startDate: dateInput(lease.startDate),
      endDate: dateInput(lease.endDate),
      monthlyRent: lease.monthlyRent,
      depositAmount: lease.depositAmount,
    });
    setError("");
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “open Renew” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - lease: ค่า “lease” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const openRenew = (lease: Lease) => {
    setEditingLease(null);
    setRenewingLease(lease);
    setForm({
      roomId: lease.room.id,
      ...renewalDates(lease.endDate),
      monthlyRent: lease.monthlyRent,
      depositAmount: lease.depositAmount,
    });
    setError("");
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “close Form” ตามกฎของระบบ
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const closeForm = () => {
    if (isSaving) return;
    setEditingLease(null);
    setRenewingLease(null);
    setIsCreateOpen(false);
    setForm(emptyForm);
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “save Lease” โดยใช้ค่าที่รับเข้ามา
   * รับค่า:
   * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const saveLease = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving || actionFeedback.isPending) return;
    if (!editingLease && !renewingLease && !form.roomId) {
      setError("กรุณาเลือกห้อง");
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      const operation = renewingLease ? "ต่อสัญญา" : editingLease ? "บันทึกสัญญาเวอร์ชันใหม่" : "สร้างสัญญา";
      await actionFeedback.runAction(async () => {
      const url = renewingLease
        ? `/api/v1/admin/properties/${propertyId}/leases/${renewingLease.id}/renew`
        : editingLease
          ? `/api/v1/admin/properties/${propertyId}/leases/${editingLease.id}`
          : `/api/v1/admin/properties/${propertyId}/leases`;
      const response = await fetch(url, {
        method: editingLease ? "PATCH" : "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingLease ? {
          expectedVersion: editingLease.currentVersion,
          startDate: form.startDate,
          endDate: form.endDate,
          monthlyRent: Number(form.monthlyRent),
          depositAmount: Number(form.depositAmount),
        } : renewingLease ? {
          startDate: form.startDate,
          endDate: form.endDate,
          monthlyRent: Number(form.monthlyRent),
          depositAmount: Number(form.depositAmount),
        } : {
          roomId: form.roomId,
          startDate: form.startDate,
          endDate: form.endDate,
          monthlyRent: Number(form.monthlyRent),
          depositAmount: Number(form.depositAmount),
        }),
      });
      await responseData<Lease>(response);
      setEditingLease(null);
      setRenewingLease(null);
      setIsCreateOpen(false);
      setForm(emptyForm);
      await loadLeases();
      }, { pending: `กำลัง${operation}...`, success: `${operation}แล้ว`, error: `${operation}ไม่สำเร็จ` }, { restoreFocus: false });
    } catch (saveError) {
      setError(formatClientError(saveError, "บันทึกสัญญาไม่สำเร็จ"));
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “transition” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - lease: ค่า “lease” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - status: ค่า “status” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const transition = async (lease: Lease, status: LeaseStatus) => {
    if (status === "CANCELLED" && !await confirm({ title: "ยกเลิกสัญญา?", description: `สัญญา ${lease.leaseNumber} จะถูกยกเลิกและเก็บไว้ในประวัติ สถานะนี้ไม่สามารถย้อนกลับจากหน้านี้ได้`, confirmLabel: "ยกเลิกสัญญา", variant: "danger" })) return;
    if (isSaving || actionFeedback.isPending) return;
    setIsSaving(true);
    setError("");
    try {
      const operation = transitionLabels[status] ?? "เปลี่ยนสถานะสัญญา";
      await actionFeedback.runAction(async () => {
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/leases/${lease.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: lease.currentVersion, status }),
      });
      await responseData(response);
      await loadLeases();
      }, { pending: `กำลัง${operation}...`, success: `${operation}แล้ว`, error: `${operation}ไม่สำเร็จ` });
    } catch (transitionError) {
      setError(formatClientError(transitionError, "เปลี่ยนสถานะไม่สำเร็จ"));
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “upload Signed Document” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - lease: ค่า “lease” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - file: ค่า “file” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const uploadSignedDocument = async (lease: Lease, file: File | undefined) => {
    if (!file) return;
    if (isSaving || actionFeedback.isPending) return;
    setIsSaving(true);
    setError("");
    try {
      await actionFeedback.runAction(async () => {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/leases/${lease.id}/signed-document`, {
        method: "POST",
        credentials: "same-origin",
        body,
      });
      await responseData(response);
      await loadLeases();
      }, { pending: "กำลังอัปโหลดเอกสารสัญญา...", success: "อัปโหลดเอกสารสัญญาแล้ว", error: "อัปโหลดสัญญาไม่สำเร็จ" });
    } catch (uploadError) {
      setError(formatClientError(uploadError, "อัปโหลดสัญญาไม่สำเร็จ"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="figma-list-page contracts-page">
      <LiveAnnouncement message={actionFeedback.announcement} />
      <div className="figma-summary-grid three">
        <ContractSummary icon={<FileText />} label="สัญญาที่โหลดแล้ว" value={`${leases.length} ฉบับ`} tone="indigo" />
        <ContractSummary icon={<CheckCircle2 />} label="ใช้งานอยู่" value={`${counts.active} ฉบับ`} tone="green" />
        <ContractSummary icon={<AlertCircle />} label={`รอดำเนินการ / ใกล้หมดใน ${LEASE_EXPIRY_NOTICE_DAYS} วัน`} value={`${counts.pending + counts.expiring} ฉบับ`} tone="orange" />
      </div>

      {error ? <div className="form-alert error" role="alert">{error}</div> : null}

      <article className="figma-table-card">
        <div className="additional-card-head">
          <div><h2>รายการสัญญาเช่า</h2><p>ตรวจสอบสถานะ ระยะเวลา เอกสาร และการต่อสัญญารายห้อง</p></div>
          {!readOnly ? <div className="disabled-action">
            <button aria-describedby={!isSaving && occupiedRooms.length === 0 ? "contract-create-disabled-reason" : undefined} className="primary-button" disabled={isSaving || occupiedRooms.length === 0} onClick={openCreate} type="button">
              <Plus size={17} /> สร้างสัญญา
            </button>
            {!isSaving && occupiedRooms.length === 0 ? <p className="disabled-reason" id="contract-create-disabled-reason">ต้องมีห้องที่มีผู้เช่าหลักได้รับอนุมัติก่อน</p> : null}
          </div> : <ReadOnlyNotice compact />}
        </div>
        <div className="figma-table-toolbar">
          <div><Search size={16} /><input aria-label="ค้นหาสัญญา" onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาเลขสัญญา ห้อง ชื่อ หรืออีเมลผู้เช่า..." value={query} /></div>
        </div>

        {isLoading ? (
          <LoadingSkeleton count={5} label="กำลังโหลดสัญญา" variant="table" />
        ) : leases.length === 0 && query.trim() ? (
          <SearchEmptyState
            description="ลองใช้เลขสัญญา เลขห้อง ชื่อ หรืออีเมลอื่น"
            title="ไม่พบสัญญาที่ค้นหา"
          />
        ) : leases.length === 0 ? (
          <div className="document-editor-state">
            <FileText />
            <p>ยังไม่มีสัญญา สร้างสัญญาได้เมื่อห้องมีผู้เช่าหลักที่อนุมัติแล้ว</p>
          </div>
        ) : (
          <div className="figma-table contract-table">
            <div className="figma-table-head"><span>สัญญา</span><span>ห้อง</span><span>ผู้เช่า</span><span>ค่าเช่า</span><span>ระยะเวลา</span><span>Version</span><span>สถานะ</span><span>จัดการ</span></div>
            {leases.map((lease) => {
              const tenant = lease.tenants.find((item) => item.isPrimary)?.occupancy.tenantProfile.user;
              const canRenew = ["ACTIVE", "EXPIRING", "EXPIRED"].includes(lease.status);
              const displayStatus = leaseDisplayStatus(lease.status, lease.endDate);
              return <div className="figma-table-row" data-status={displayStatus} key={lease.id}>
                <span className="tenant-name-cell">{lease.leaseNumber}</span>
                <span>{lease.room.number}</span>
                <span>{tenant?.displayName ?? "-"}</span>
                <span>{currency.format(Number(lease.monthlyRent))}</span>
                <span className="muted-cell">{dateDisplay(lease.startDate)} – {dateDisplay(lease.endDate)}</span>
                <span>v{lease.currentVersion}</span>
                <span><em className={`figma-status ${displayStatus === "ACTIVE" ? "normal" : displayStatus === "EXPIRING" ? "warning" : ""}`}>{statusLabels[displayStatus]}</em></span>
                <span className="contract-actions">
                  {!readOnly && displayStatus === "EXPIRING" ? (
                    <button
                      aria-label={`ต่อสัญญา ${lease.leaseNumber}`}
                      className="primary-button contract-renew-button"
                      disabled={isSaving}
                      onClick={() => openRenew(lease)}
                      type="button"
                    >
                      <FilePlus2 aria-hidden="true" size={16} /> ต่อสัญญา
                    </button>
                  ) : null}
                  {!readOnly && ["DRAFT", "PENDING_SIGNATURE"].includes(lease.status) ? (
                    <input accept="application/pdf,.pdf" className="sr-only" disabled={isSaving} onChange={(event) => { void uploadSignedDocument(lease, event.target.files?.[0]); event.target.value = ""; }} ref={(node) => { if (node) signedDocumentInputs.current.set(lease.id, node); else signedDocumentInputs.current.delete(lease.id); }} type="file" />
                  ) : null}
                  {lease.signedStorageKey || (!readOnly && (canRenew || ["DRAFT", "PENDING_SIGNATURE"].includes(lease.status) || leaseStatusTransitions[lease.status].length > 0)) ? <ActionMenu
                    items={[
                      ...(!readOnly && canRenew && displayStatus !== "EXPIRING" ? [
                        { disabled: isSaving, icon: <FilePlus2 aria-hidden="true" size={16} />, id: "renew", label: "ต่อสัญญา", onSelect: () => openRenew(lease) },
                      ] : []),
                      ...(!readOnly && ["DRAFT", "PENDING_SIGNATURE"].includes(lease.status) ? [
                        { disabled: isSaving, icon: <Pencil aria-hidden="true" size={16} />, id: "edit", label: "แก้ไขและสร้างเวอร์ชันใหม่", onSelect: () => openEdit(lease) },
                        { disabled: isSaving, icon: <Upload aria-hidden="true" size={16} />, id: "upload", label: "อัปโหลด PDF ที่ลงนามแล้ว", onSelect: () => signedDocumentInputs.current.get(lease.id)?.click() },
                      ] : []),
                      ...(lease.signedStorageKey ? [{ icon: <Download aria-hidden="true" size={16} />, id: "download", label: "เปิดเอกสารลงนาม", onSelect: () => window.open(`/api/v1/admin/properties/${propertyId}/leases/${lease.id}/signed-document`, "_blank", "noopener,noreferrer") }] : []),
                      ...(!readOnly ? leaseStatusTransitions[lease.status].filter((status) => status !== "EXPIRING").map((status) => ({
                        disabled: isSaving || (status === "ACTIVE" && !lease.signedStorageKey),
                        icon: <Settings2 aria-hidden="true" size={16} />,
                        id: `status-${status}`,
                        label: status === "ACTIVE" && !lease.signedStorageKey ? `${transitionLabels[status]} (ต้องอัปโหลดเอกสารก่อน)` : transitionLabels[status] ?? status,
                        onSelect: () => void transition(lease, status),
                        variant: status === "CANCELLED" ? "danger" as const : undefined,
                      })) : []),
                    ]}
                    label={`จัดการสัญญา ${lease.leaseNumber}`}
                  /> : null}
                </span>
              </div>;
            })}
          </div>
        )}
        <ServerTablePagination currentItemCount={leases.length} disabled={isLoading} onPageChange={(nextPage) => void loadLeases(nextPage)} pageInfo={pageInfo} />
      </article>

      {(isCreateOpen || editingLease || renewingLease) ? (
        <Dialog ariaDescribedBy="lease-form-description" ariaLabelledBy="lease-form-title" onClose={closeForm}>
            <header className="modal-header">
              <div>
                <h2 id="lease-form-title">{renewingLease ? "ต่อสัญญา" : editingLease ? "แก้ไขสัญญา" : "สร้างสัญญาใหม่"}</h2>
                <p id="lease-form-description">{renewingLease ? `สร้างสัญญารอบใหม่ต่อจาก ${renewingLease.leaseNumber} โดยเก็บฉบับเดิมไว้` : editingLease ? `การบันทึกจะสร้าง version ${editingLease.currentVersion + 1}` : "เลือกห้องที่มีผู้เช่าหลักและกำหนดรายละเอียดสัญญา"}</p>
              </div>
              <IconButton disabled={isSaving} label="ปิด" onClick={closeForm} tooltip="ปิดหน้าต่างสัญญา"><X /></IconButton>
            </header>
            <form className="modal-form" onSubmit={saveLease}>
              <div className="modal-grid">
                <DropdownField disabled={Boolean(editingLease || renewingLease) || isSaving} label="ห้อง" onChange={(value) => {
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “room” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - item: ค่า “item” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
    const room = occupiedRooms.find((item) => item.databaseId === value);
                  setForm((current) => ({ ...current, roomId: value, monthlyRent: room ? String(room.rent) : current.monthlyRent }));
                }} options={[{ label: "เลือกห้อง", value: "" }, ...occupiedRooms.flatMap((room) => room.databaseId ? [{ label: `ห้อง ${room.id}`, value: room.databaseId }] : [])]} value={form.roomId} />
                <label><span>ค่าเช่าต่อเดือน</span><input min="0" onChange={(event) => setForm((current) => ({ ...current, monthlyRent: event.target.value }))} required step="0.01" type="number" value={form.monthlyRent} /></label>
                <label><span>วันเริ่มสัญญา</span><input min={renewingLease ? renewalDates(renewingLease.endDate).startDate : undefined} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} required type="date" value={form.startDate} /></label>
                <label><span>วันสิ้นสุดสัญญา</span><input min={form.startDate || undefined} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} required type="date" value={form.endDate} /></label>
                <label><span>เงินประกัน</span><input min="0" onChange={(event) => setForm((current) => ({ ...current, depositAmount: event.target.value }))} required step="0.01" type="number" value={form.depositAmount} /></label>
              </div>
              <footer className="modal-actions">
                <button disabled={isSaving} onClick={closeForm} type="button">ยกเลิก</button>
                <button className="primary-button" disabled={isSaving} type="submit">{isSaving ? "กำลังบันทึก..." : renewingLease ? "สร้างสัญญาต่ออายุ" : editingLease ? "บันทึก version ใหม่" : "สร้างสัญญา"}</button>
              </footer>
            </form>
        </Dialog>
      ) : null}
      {confirmationDialog}
    </section>
  );
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Contract Summary” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { icon, label, tone, value }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function ContractSummary({ icon, label, tone, value }: { icon: React.ReactNode; label: string; tone: string; value: string }) {
  return <article className={`figma-summary-card tone-${tone}`}><div><small>{label}</small><strong>{value}</strong></div><span>{icon}</span></article>;
}
