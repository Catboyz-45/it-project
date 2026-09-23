"use client";
// เก็บฟอร์ม โหลดข้อมูล และอัปโหลดไฟล์จากเบราว์เซอร์

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Eye,
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
import { generateDocumentPdf, previewDocumentPdf } from "@/lib/client/documents";
import type { ContractDocumentData } from "@/lib/documents/placeholders";
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
import { PageHeaderActions } from "@/components/ui/PageHeaderSlot";
import { useActionFeedback } from "@/lib/client/use-action-feedback";

// สัญญาหนึ่งฉบับ
type Lease = {
  id: string;
  leaseNumber: string;
  status: LeaseStatus;
  startDate: string;
  endDate: string;
  monthlyRent: string;
  depositAmount: string;
  // ส่งกลับไปตอนแก้ไข เซิร์ฟเวอร์จะปฏิเสธถ้ามีคนอื่นแก้ไปก่อนแล้ว กันแก้ทับกัน
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
  // แก้สัญญาแต่ละครั้งเก็บเป็นเวอร์ชันใหม่ ไม่ทับของเดิม เพื่อให้ตรวจย้อนหลังได้
  versions: Array<{
    id: string;
    version: number;
    documentId: string | null;
    signedStorageKey: string | null;
    createdAt: string;
  }>;
};

type LeaseForm = {
  roomId: string;
  startDate: string;
  endDate: string;
  monthlyRent: string;
  depositAmount: string;
};

// Record บังคับให้ครอบคลุมทุกสถานะตั้งแต่ตอนคอมไพล์ เพิ่มสถานะใหม่แล้วลืมแปลจะคอมไพล์ไม่ผ่าน
const statusLabels: Record<LeaseStatus, string> = {
  DRAFT: "ฉบับร่าง",
  PENDING_SIGNATURE: "รอลงนาม",
  ACTIVE: "ใช้งาน",
  EXPIRING: "ใกล้หมดอายุ",
  EXPIRED: "หมดอายุ",
  CANCELLED: "ยกเลิก",
};

// Partial เพราะบางสถานะเปลี่ยนเข้าไปเองไม่ได้ เช่น EXPIRING ที่ระบบคำนวณจากวันหมดอายุ
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

// แปลงเป็น "YYYY-MM-DD" ซึ่งเป็นรูปแบบเดียวที่ input type="date" ยอมรับ
function dateInput(value: string) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

// แปลงเป็นข้อความแบบไทยไว้แสดงในตาราง
function dateDisplay(value: string) {
  return new Date(value).toLocaleDateString("th-TH");
}

// คำนวณช่วงของสัญญาใหม่ให้ต่อจากฉบับเดิมพอดี ไม่ทับและไม่เว้นช่อง
// ใช้ UTC ทั้งหมดกันวันเลื่อนตามเขตเวลาของเครื่องที่เปิด
function renewalDates(endDate: string) {
  // เริ่มวันถัดจากวันสิ้นสุดของฉบับเดิม
  const start = new Date(endDate);
  start.setUTCDate(start.getUTCDate() + 1);
  // ยาวหนึ่งปี ลบหนึ่งวัน เช่น 1 ม.ค. 2569 ถึง 31 ธ.ค. 2569
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  end.setUTCDate(end.getUTCDate() - 1);
  return { startDate: dateInput(start.toISOString()), endDate: dateInput(end.toISOString()) };
}

// ห่อ readApiData ไว้ให้ข้อความผิดพลาดของทั้งไฟล์นี้เหมือนกันหมด
async function responseData<T>(response: Response): Promise<T> {
  return readApiData<T>(response, "ดำเนินการไม่สำเร็จ");
}

// หน้าสัญญาเช่า สร้าง แก้ไข ต่ออายุ เปลี่ยนสถานะ และแนบไฟล์ที่ลงนามแล้ว
// initialLeases กับ initialPageInfo ส่งมาจาก Server Component ของหน้านี้
// มีแล้วก็ไม่ต้องยิงซ้ำตอนเปิดหน้า ส่วนการค้นหาและเปลี่ยนหน้ายังโหลดเองเหมือนเดิม
export function ContractsPage({ initialLeases = null, initialPageInfo = null, propertyId, propertyName, readOnly = false, rooms }: { initialLeases?: Lease[] | null; initialPageInfo?: ServerPageInfo | null; propertyId: string; propertyName: string; readOnly?: boolean; rooms: Room[] }) {
  const searchParams = useSearchParams();
  // กันเปิดฟอร์มซ้ำ เพราะ effect ที่อ่านค่าจาก URL อาจทำงานหลายรอบ
  const moveRoomDraftHandled = useRef(false);
  const signedDocumentInputs = useRef(new Map<string, HTMLInputElement>());
  const [leases, setLeases] = useState<Lease[]>(initialLeases ?? []);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(initialLeases === null);
  const [pageInfo, setPageInfo] = useState<ServerPageInfo>(initialPageInfo ?? { page: 1, pageSize: 20, hasNextPage: false });
  const skipInitialLoadRef = useRef(initialLeases !== null);
  const [isSaving, setIsSaving] = useState(false);
  const actionFeedback = useActionFeedback();
  const [editingLease, setEditingLease] = useState<Lease | null>(null);
  const [renewingLease, setRenewingLease] = useState<Lease | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState<LeaseForm>(emptyForm);
  const { confirm, confirmationDialog } = useConfirmation();

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
    // เซิร์ฟเวอร์ส่งหน้าแรกมาแล้ว รอบแรกจึงข้ามไป ไม่ใช่ยิงทับของที่มีอยู่
    if (skipInitialLoadRef.current) {
      skipInitialLoadRef.current = false;
      return;
    }
    const controller = new AbortController();
    // หน่วง 250 มิลลิวินาทีหลังหยุดพิมพ์ จะได้ไม่ยิงทุกครั้งที่กดแป้น
    // ส่วน abort ยกเลิกคำขอเก่า กันผลเก่ามาถึงทีหลังแล้วทับผลใหม่
    const timeout = window.setTimeout(() => void loadLeases(1, controller.signal), 250);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [loadLeases]);

  // นับจากข้อมูลของหน้าที่โหลดมาแล้ว จึงเป็นตัวเลขของหน้านี้ ไม่ใช่ทั้งหอ
  // ใช้ leaseDisplayStatus เพราะ EXPIRING คำนวณจากวันหมดอายุ ไม่ได้เก็บในฐานข้อมูล
  const counts = useMemo(() => ({
    active: leases.filter((lease) => leaseDisplayStatus(lease.status, lease.endDate) === "ACTIVE").length,
    pending: leases.filter((lease) => ["DRAFT", "PENDING_SIGNATURE"].includes(lease.status)).length,
    expiring: leases.filter((lease) => leaseDisplayStatus(lease.status, lease.endDate) === "EXPIRING").length,
  }), [leases]);

  // ทำสัญญาได้เฉพาะห้องที่มีคนอยู่ และต้องมีอยู่ในฐานข้อมูลจริง
  const occupiedRooms = rooms.filter((room) => room.status === "occupied" && room.databaseId);

  // มาจากการย้ายห้อง กล่องย้ายห้องส่งข้อมูลมาทาง URL เพื่อเปิดฟอร์มสัญญาใหม่ที่กรอกไว้ให้แล้ว
  useEffect(() => {
    if (readOnly || moveRoomDraftHandled.current) return;
    const roomId = searchParams.get("createLeaseForRoom");
    if (!roomId) return;
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
    // ล้างค่าออกจาก URL หลังใช้แล้ว กันกดรีเฟรชแล้วฟอร์มเด้งขึ้นมาอีก
    window.history.replaceState(window.history.state, "", window.location.pathname);
  }, [occupiedRooms, readOnly, searchParams]);

  // เปิดฟอร์มสัญญาใหม่ กรอกห้องแรกกับค่าเช่าของห้องนั้นไว้ให้ก่อน
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

  // ต่อสัญญา ใช้เงื่อนไขเดิมแล้วเลื่อนช่วงวันที่ไปอีกปี
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

  const closeForm = () => {
    // ห้ามปิดตอนกำลังบันทึก จะได้ไม่ค้างว่าบันทึกไปแล้วหรือยัง
    if (isSaving) return;
    setEditingLease(null);
    setRenewingLease(null);
    setIsCreateOpen(false);
    setForm(emptyForm);
  };

  // ใช้ตัวเดียวกันทั้งสร้าง แก้ไข และต่ออายุ ต่างกันที่ URL กับข้อมูลที่ส่ง
  const saveLease = async (event: FormEvent<HTMLFormElement>) => {
    // กันเบราว์เซอร์รีเฟรชหน้าตามพฤติกรรมฟอร์มปกติ
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
        // แก้ไขต้องส่ง expectedVersion ไปด้วย ส่วนต่ออายุกับสร้างใหม่ไม่ต้อง เพราะไม่ได้แตะของเดิม
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
      // ไม่คืนโฟกัส เพราะกล่องฟอร์มปิดตัวเองและจัดการโฟกัสอยู่แล้ว
      }, { pending: `กำลัง${operation}...`, success: `${operation}แล้ว`, error: `${operation}ไม่สำเร็จ` }, { restoreFocus: false });
    } catch (saveError) {
      setError(formatClientError(saveError, "บันทึกสัญญาไม่สำเร็จ"));
    } finally {
      setIsSaving(false);
    }
  };

  // เปลี่ยนสถานะสัญญา ร่าง > รอลงนาม > ใช้งาน หรือปิดเป็นหมดอายุหรือยกเลิก
  const transition = async (lease: Lease, status: LeaseStatus) => {
    // ถามยืนยันเฉพาะตอนยกเลิก เพราะเป็นทางเดียวที่ย้อนกลับจากหน้านี้ไม่ได้
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

  // แนบไฟล์สัญญาที่ลงนามจริงแล้ว เก็บไว้เป็นหลักฐานคู่กับข้อมูลในระบบ
  const uploadSignedDocument = async (lease: Lease, file: File | undefined) => {
    if (!file) return;
    if (isSaving || actionFeedback.isPending) return;
    setIsSaving(true);
    setError("");
    try {
      await actionFeedback.runAction(async () => {
      // FormData เพราะเป็นไฟล์ ไม่ใช่ JSON และปล่อยให้เบราว์เซอร์ตั้ง Content-Type เอง
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

  // สร้างเอกสารสัญญา ดูตัวอย่างหรือดาวน์โหลดจริง
  const requestContractPdf = async (lease: Lease, tenantName: string, action: "preview" | "generate") => {
    if (actionFeedback.isPending) return;
    const data: ContractDocumentData = {
      property_name: propertyName,
      room_number: lease.room.number,
      tenant_name: tenantName,
      tenant_phone: "",
      tenant_address: "",
      reference_id: lease.leaseNumber,
      start_date: dateInput(lease.startDate),
      end_date: dateInput(lease.endDate),
      rent_amount: Number(lease.monthlyRent),
      deposit_amount: Number(lease.depositAmount),
    };
    try {
      await actionFeedback.runAction(
        async () => {
          if (action === "preview") await previewDocumentPdf(propertyId, "contract", data);
          else await generateDocumentPdf(propertyId, "contract", data);
        },
        action === "preview"
          ? { pending: "กำลังสร้างตัวอย่าง...", success: "เปิดตัวอย่างสัญญาแล้ว", error: "ดูตัวอย่างสัญญาไม่สำเร็จ" }
          : { pending: "กำลังสร้าง PDF...", success: "ดาวน์โหลด PDF สัญญาแล้ว", error: "สร้าง PDF สัญญาไม่สำเร็จ" },
      );
    } catch {
      // actionFeedback already surfaced the error via toast/announcement.
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
        <PageHeaderActions>
          {!readOnly ? <div className="disabled-action">
            <button aria-describedby={!isSaving && occupiedRooms.length === 0 ? "contract-create-disabled-reason" : undefined} className="primary-button" disabled={isSaving || occupiedRooms.length === 0} onClick={openCreate} type="button">
              <Plus size={17} /> สร้างสัญญา
            </button>
            {!isSaving && occupiedRooms.length === 0 ? <p className="disabled-reason" id="contract-create-disabled-reason">ต้องมีห้องที่มีผู้เช่าหลักได้รับอนุมัติก่อน</p> : null}
          </div> : <ReadOnlyNotice compact />}
        </PageHeaderActions>
        <div className="figma-table-toolbar">
          <div><Search size={16} /><input aria-label="ค้นหาสัญญา" onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาเลขสัญญา ห้อง ชื่อ หรืออีเมลผู้เช่า..." value={query} /></div>
        </div>

        {isLoading ? (
          <LoadingSkeleton columns={8} count={5} label="กำลังโหลดสัญญา" tableClassName="contract-table" variant="table" />
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
          <div className="figma-table-wrap">
          <table className="figma-table contract-table">
            <thead>
              <tr className="figma-table-head"><th scope="col">สัญญา</th><th scope="col">ห้อง</th><th scope="col">ผู้เช่า</th><th scope="col">ค่าเช่า</th><th scope="col">ระยะเวลา</th><th scope="col">Version</th><th scope="col">สถานะ</th><th scope="col">จัดการ</th></tr>
            </thead>
            <tbody>
            {leases.map((lease) => {
              const tenant = lease.tenants.find((item) => item.isPrimary)?.occupancy.tenantProfile.user;
              const canRenew = ["ACTIVE", "EXPIRING", "EXPIRED"].includes(lease.status);
              const displayStatus = leaseDisplayStatus(lease.status, lease.endDate);
              return <tr className="figma-table-row" data-status={displayStatus} key={lease.id}>
                <td className="tenant-name-cell">{lease.leaseNumber}</td>
                <td>{lease.room.number}</td>
                <td>{tenant?.displayName ?? "-"}</td>
                <td>{currency.format(Number(lease.monthlyRent))}</td>
                <td className="muted-cell">{dateDisplay(lease.startDate)} – {dateDisplay(lease.endDate)}</td>
                <td>v{lease.currentVersion}</td>
                <td><em className={`figma-status ${displayStatus === "ACTIVE" ? "normal" : displayStatus === "EXPIRING" ? "warning" : ""}`}>{statusLabels[displayStatus]}</em></td>
                <td className="contract-actions">
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
                  {tenant || lease.signedStorageKey || (!readOnly && (canRenew || ["DRAFT", "PENDING_SIGNATURE"].includes(lease.status) || leaseStatusTransitions[lease.status].length > 0)) ? <ActionMenu
                    items={[
                      ...(tenant ? [
                        { disabled: actionFeedback.isPending, icon: <Eye aria-hidden="true" size={16} />, id: "preview-pdf", label: "ดูตัวอย่างสัญญา (PDF)", onSelect: () => void requestContractPdf(lease, tenant.displayName, "preview") },
                        ...(!readOnly ? [
                          { disabled: actionFeedback.isPending, icon: <Download aria-hidden="true" size={16} />, id: "generate-pdf", label: "ดาวน์โหลด PDF สัญญา", onSelect: () => void requestContractPdf(lease, tenant.displayName, "generate") },
                        ] : []),
                      ] : []),
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
                </td>
              </tr>;
            })}
            </tbody>
          </table>
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

// การ์ดตัวเลขสรุปด้านบน ใช้แค่ในไฟล์นี้ จึงไม่ต้อง export
function ContractSummary({ icon, label, tone, value }: { icon: React.ReactNode; label: string; tone: string; value: string }) {
  return <article className={`figma-summary-card tone-${tone}`}><div><small>{label}</small><strong>{value}</strong></div><span>{icon}</span></article>;
}
