"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Parcels Page” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Ban, CheckCircle2, ImageUp, PackageCheck, Pencil, Plus } from "lucide-react";
import { DropdownField } from "@/components/dorm/DropdownField";
import { ReadOnlyNotice } from "@/components/dorm/ReadOnlyNotice";
import type { Room } from "@/types/dorm";
import { TablePagination, useTablePagination } from "@/components/dorm/TablePagination";
import { Button } from "@/components/ui/Button";
import { LoadMoreButton } from "@/components/ui/DataNavigation";
import { Dialog } from "@/components/ui/Dialog";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { useConfirmation } from "@/components/ui/use-confirmation";
import { LiveAnnouncement } from "@/components/ui/LiveAnnouncement";
import { useActionFeedback } from "@/lib/client/use-action-feedback";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Parcel View” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type ParcelView = "waiting" | "history";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Parcel Status” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type ParcelStatus = "waiting" | "received" | "cancelled";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Parcel Record” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type ParcelRecord = {
  id: string;
  imageUrl?: string;
  note: string;
  roomId: string;
  tenantName: string;
  receivedAt?: string;
  registeredAt: string;
  status: ParcelStatus;
  updatedAt?: string;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Parcels Page” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { activeView, initialParcels, onChanged, propertyId, readOnl: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function ParcelsPage({
  activeView,
  initialParcels,
  onChanged,
  propertyId,
  readOnly = false,
  rooms,
}: {
  activeView: ParcelView;
  initialParcels: ParcelRecord[];
  onChanged: () => Promise<void>;
  propertyId: string;
  readOnly?: boolean;
  rooms: Room[];
}) {
  const notify = useToast();
  const actionFeedback = useActionFeedback();
  const { confirm, confirmationDialog } = useConfirmation();
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “occupied Rooms” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - room: ค่า “room” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const occupiedRooms = rooms.filter((room) => room.status === "occupied");
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “floors” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - a: ค่า “a” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - b: ค่า “b” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const floors = Array.from(new Set(rooms.map((room) => room.floor))).sort((a, b) => a - b);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [editingParcel, setEditingParcel] = useState<ParcelRecord | null>(null);
  const [editNote, setEditNote] = useState("");
  const [parcels, setParcels] = useState(initialParcels);
  const [summary, setSummary] = useState({ today: 0, waiting: 0, received: 0, olderThanThreeDays: 0 });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [requestError, setRequestError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [serverPage, setServerPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [selectedFloor, setSelectedFloor] = useState(floors[0] ?? 1);
  const [form, setForm] = useState({
    imageUrl: "",
    note: "",
    roomId: occupiedRooms[0]?.id ?? rooms[0]?.id ?? "",
  });
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “floor Rooms” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - room: ค่า “room” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const floorRooms = occupiedRooms.filter((room) => room.floor === selectedFloor);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “waiting Parcels” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - parcel: ค่า “parcel” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const waitingParcels = parcels.filter((parcel) => parcel.status === "waiting");
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “received Parcels” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - parcel: ค่า “parcel” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const receivedParcels = parcels.filter((parcel) => parcel.status === "received");
  const visibleParcels = activeView === "waiting" ? waitingParcels : receivedParcels;
  const { page, pageItems, setPage, totalPages } = useTablePagination(visibleParcels);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “load Parcels” แล้วส่งผลที่เหมาะสมกลับไป
   * รับค่า:
   * - targetPage: ค่า “target Page” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - append: ค่า “append” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const loadParcels = useCallback(async (targetPage = 1, append = false) => {
    if (append) setIsLoadingMore(true);
    else setIsLoading(true);
    setRequestError("");
    try {
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/parcels?page=${targetPage}&pageSize=50`, { cache: "no-store" });
      const payload = await response.json() as {
        data?: Array<{
          id: string; status: "WAITING" | "RECEIVED" | "CANCELLED"; note: string | null; updatedAt: string;
          registeredAt: string; receivedAt: string | null; imageUrl: string | null;
          recipientTenant: { id: string; user: { displayName: string } } | null;
          room: { number: string; occupancies: Array<{ tenantProfile: { user: { displayName: string } } }> };
        }>;
        error?: string;
        pageInfo?: { page: number; hasNextPage: boolean };
        summary?: { today: number; waiting: number; received: number; olderThanThreeDays: number };
      };
      if (!response.ok || !payload.data || !payload.pageInfo) throw new Error(payload.error || "โหลดพัสดุไม่สำเร็จ");
      /**
       * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
       * หน้าที่: แปลงข้อมูลในขั้นตอน “mapped” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
       * รับค่า:
       * - item: ค่า “item” ที่จำเป็นต่อการทำงานของก้อนนี้
       * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
       */
      const mapped: ParcelRecord[] = payload.data.map((item) => ({
        id: item.id,
        imageUrl: item.imageUrl ?? undefined,
        note: item.note ?? "",
        roomId: item.room.number,
        tenantName: item.recipientTenant?.user.displayName ?? "พัสดุส่วนกลางของห้อง",
        registeredAt: new Date(item.registeredAt).toLocaleString("th-TH"),
        receivedAt: item.receivedAt ? new Date(item.receivedAt).toLocaleString("th-TH") : undefined,
        status: item.status === "WAITING" ? "waiting" : item.status === "RECEIVED" ? "received" : "cancelled",
        updatedAt: item.updatedAt,
      }));
      setParcels((current) => append ? [...current, ...mapped] : mapped);
      setServerPage(payload.pageInfo.page);
      setHasNextPage(payload.pageInfo.hasNextPage);
      if (payload.summary) setSummary(payload.summary);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "โหลดพัสดุไม่สำเร็จ");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [propertyId]);
  useEffect(() => { void loadParcels(); }, [loadParcels]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “register Parcel” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const registerParcel = async () => {
    setIsSaving(true);
    setRequestError("");
    try {
      const payload = new FormData();
      /**
       * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
       * หน้าที่: รวมขั้นตอนย่อยของ “room” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
       * รับค่า:
       * - item: ค่า “item” ที่จำเป็นต่อการทำงานของก้อนนี้
       * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
       */
      const room = rooms.find((item) => item.id === form.roomId);
      if (!room?.databaseId) throw new Error("ไม่พบรหัสห้องในฐานข้อมูล");
      payload.set("roomId", room.databaseId);
      if (room.tenantId) payload.set("recipientTenantId", room.tenantId);
      if (form.note.trim()) payload.set("note", form.note.trim());
      if (selectedFile) payload.set("file", selectedFile);
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/parcels`, { method: "POST", body: payload });
      if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error || "ลงทะเบียนพัสดุไม่สำเร็จ");
      if (form.imageUrl) URL.revokeObjectURL(form.imageUrl);
      setForm((current) => ({ ...current, imageUrl: "", note: "" }));
      setSelectedFile(null);
      setIsRegisterOpen(false);
      await loadParcels();
      await onChanged();
      notify({ message: "ลงทะเบียนพัสดุแล้ว" });
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "ลงทะเบียนพัสดุไม่สำเร็จ");
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “mark Received” โดยใช้ค่าที่รับเข้ามา
   * รับค่า:
   * - parcelId: รหัสภายในของ parcel
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const markReceived = async (parcelId: string) => {
    if (actionFeedback.isPending) return;
    setRequestError("");
    try {
      await actionFeedback.runAction(async () => {
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/parcels/${parcelId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "RECEIVED", expectedUpdatedAt: parcels.find((item) => item.id === parcelId)?.updatedAt }),
      });
      if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error || "อัปเดตพัสดุไม่สำเร็จ");
      await loadParcels();
      await onChanged();
      }, { pending: "กำลังบันทึกการรับพัสดุ...", success: "บันทึกว่าผู้เช่ารับพัสดุแล้ว", error: "บันทึกการรับพัสดุไม่สำเร็จ" });
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "อัปเดตพัสดุไม่สำเร็จ");
    }
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “save Parcel Edit” โดยใช้ค่าที่รับเข้ามา
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const saveParcelEdit = async () => {
    if (!editingParcel) return;
    setIsSaving(true); setRequestError("");
    try {
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/parcels/${editingParcel.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: editNote.trim() || null, expectedUpdatedAt: editingParcel.updatedAt }),
      });
      if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error || "แก้ไขพัสดุไม่สำเร็จ");
      setEditingParcel(null); await loadParcels(); await onChanged(); notify({ message: "แก้ไขข้อมูลพัสดุแล้ว" });
    } catch (error) { setRequestError(error instanceof Error ? error.message : "แก้ไขพัสดุไม่สำเร็จ"); }
    finally { setIsSaving(false); }
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “cancel Parcel” ตามกฎของระบบ
   * รับค่า:
   * - parcel: ค่า “parcel” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const cancelParcel = async (parcel: ParcelRecord) => {
    if (!await confirm({ title: "ยกเลิกรายการพัสดุ?", description: `พัสดุห้อง ${parcel.roomId} จะถูกยกเลิกและไม่แสดงแก่ผู้เช่า การทำรายการนี้ย้อนกลับไม่ได้`, confirmLabel: "ยกเลิกพัสดุ", variant: "danger" })) return;
    setRequestError("");
    try {
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/parcels/${parcel.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "CANCELLED", expectedUpdatedAt: parcel.updatedAt }) });
      if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error || "ยกเลิกพัสดุไม่สำเร็จ");
      await loadParcels(); await onChanged(); notify({ message: "ยกเลิกรายการพัสดุแล้ว" });
    } catch (error) { setRequestError(error instanceof Error ? error.message : "ยกเลิกพัสดุไม่สำเร็จ"); }
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รับเหตุการณ์ “handle Floor Change” จากผู้ใช้หรือระบบ แล้วเรียกขั้นตอนที่เกี่ยวข้อง
   * รับค่า:
   * - floor: ค่า “floor” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const handleFloorChange = (floor: number) => {
    const nextRoom = occupiedRooms.find((room) => room.floor === floor) ?? rooms.find((room) => room.floor === floor);
    setSelectedFloor(floor);
    setForm((current) => ({ ...current, roomId: nextRoom?.id ?? "" }));
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รับเหตุการณ์ “handle Image Upload” จากผู้ใช้หรือระบบ แล้วเรียกขั้นตอนที่เกี่ยวข้อง
   * รับค่า:
   * - file: ค่า “file” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const handleImageUpload = (file: File | undefined) => {
    if (!file) return;
    if (form.imageUrl) URL.revokeObjectURL(form.imageUrl);
    setSelectedFile(file);
    setForm((current) => ({ ...current, imageUrl: URL.createObjectURL(file) }));
  };

  return (
    <section className="repair-page">
      <LiveAnnouncement message={actionFeedback.announcement} />
      {requestError ? <p className="form-alert error" role="alert">{requestError}</p> : null}
      {readOnly ? <ReadOnlyNotice>ดูรูป รายการรอรับ ประวัติ และโหลดรายการเพิ่มเติมได้ แต่ไม่สามารถลงทะเบียนหรือบันทึกการรับพัสดุ</ReadOnlyNotice> : null}
      {isLoading ? <LoadingSkeleton count={4} label="กำลังโหลดพัสดุ" variant="cards" /> : null}
      <div className="figma-summary-grid four parcel-summary-grid">
        <article className="figma-summary-card tone-indigo"><div><small>พัสดุเข้าวันนี้</small><strong>{summary.today} ชิ้น</strong></div><span><PackageCheck size={20} /></span></article>
        <article className="figma-summary-card tone-orange"><div><small>รอผู้เช่ารับ</small><strong>{summary.waiting} ชิ้น</strong></div><span><PackageCheck size={20} /></span></article>
        <article className="figma-summary-card tone-green"><div><small>รับแล้ว</small><strong>{summary.received} ชิ้น</strong></div><span><CheckCircle2 size={20} /></span></article>
        <article className="figma-summary-card tone-red"><div><small>ค้างเกิน 3 วัน</small><strong>{summary.olderThanThreeDays} ชิ้น</strong></div><span><PackageCheck size={20} /></span></article>
      </div>
      <article className="repair-board">
        <div className="repair-board-head">
          <div>
            <h2>{activeView === "waiting" ? "พัสดุที่รอผู้เช่ารับ" : "ประวัติรับพัสดุ"}</h2>
            <p>
              {activeView === "waiting"
                ? `${waitingParcels.length} รายการรอรับ · กดรับแล้วเมื่อส่งมอบแล้ว`
                : `${receivedParcels.length} รายการรับแล้ว`}
            </p>
          </div>
          {!readOnly ? (
            <button className="primary-button" onClick={() => setIsRegisterOpen(true)} type="button">
              <Plus aria-hidden="true" size={18} /> รับพัสดุใหม่
            </button>
          ) : <span className="badge badge-paid">{waitingParcels.length} รอรับ</span>}
        </div>

        {!isLoading && pageItems.length > 0 ? (
          <div className="parcel-table-wrap">
            <table className="parcel-table status-scan-table">
              <thead>
                <tr><th>พัสดุ</th><th>ห้อง / ผู้รับ</th><th>หมายเหตุ</th><th>วันที่ลงทะเบียน</th><th>สถานะ</th><th>จัดการ</th></tr>
              </thead>
              <tbody>
                {pageItems.map((parcel) => (
                  <tr data-status={parcel.status} key={parcel.id}>
                    <td data-label="พัสดุ">
                      {parcel.imageUrl ? <div className="parcel-table-photo"><Image alt={`รูปพัสดุห้อง ${parcel.roomId}`} height={52} src={parcel.imageUrl} unoptimized width={52} /></div> : <span className="parcel-muted">—</span>}
                    </td>
                    <td data-label="ห้อง / ผู้รับ"><strong>ห้อง {parcel.roomId}</strong><small>{parcel.tenantName}</small></td>
                    <td data-label="หมายเหตุ">{parcel.note || <span className="parcel-muted">ไม่มีหมายเหตุ</span>}</td>
                    <td data-label="วันที่ลงทะเบียน"><time>{parcel.registeredAt}</time></td>
                    <td data-label="สถานะ">
                      <span className={`parcel-status ${parcel.status}`}>{parcel.status === "waiting" ? "รอรับ" : "รับแล้ว"}</span>
                      {parcel.receivedAt ? <small>เมื่อ {parcel.receivedAt}</small> : null}
                    </td>
                    <td data-label="จัดการ">
                      {parcel.status === "waiting" && !readOnly ? <ActionMenu label={`จัดการพัสดุห้อง ${parcel.roomId}`} items={[
                        { disabled: actionFeedback.isPending, id: "received", label: actionFeedback.isPending ? "กำลังบันทึก..." : "บันทึกว่ารับแล้ว", icon: <CheckCircle2 size={16} />, onSelect: () => void markReceived(parcel.id) },
                        { id: "edit", label: "แก้ไขหมายเหตุ", icon: <Pencil size={16} />, onSelect: () => { setEditingParcel(parcel); setEditNote(parcel.note); } },
                        { id: "cancel", label: "ยกเลิกรายการ", icon: <Ban size={16} />, variant: "danger", onSelect: () => void cancelParcel(parcel) },
                      ]} /> : <span className="parcel-muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !isLoading ? (
          <div className="repair-empty">
            <strong>{activeView === "waiting" ? "ยังไม่มีพัสดุรอรับ" : "ยังไม่มีประวัติรับพัสดุ"}</strong>
            <span>{activeView === "waiting" ? "กดเพิ่มพัสดุเพื่อบันทึกรายการใหม่" : "รายการจะย้ายมาที่นี่หลังจากกดรับแล้ว"}</span>
          </div>
        ) : <LoadingSkeleton count={4} label="กำลังโหลดรายการพัสดุ" variant="table" />}
        <TablePagination page={page} setPage={setPage} totalItems={visibleParcels.length} totalPages={totalPages} />
        {hasNextPage ? <LoadMoreButton isLoading={isLoadingMore} label="โหลดพัสดุเพิ่มเติม" onClick={() => void loadParcels(serverPage + 1, true)} /> : null}
      </article>

      {isRegisterOpen && !readOnly ? (
        <Dialog ariaDescribedBy="parcel-register-description" ariaLabelledBy="parcel-register-title" className="repair-flow-modal" closeOnBackdrop onClose={() => setIsRegisterOpen(false)}>
            <div className="modal-header">
              <div>
                <small id="parcel-register-description">ลงทะเบียนพัสดุเข้าหอ</small>
                <h2 id="parcel-register-title">เพิ่มพัสดุใหม่</h2>
              </div>
              <Button aria-label="ปิด" data-dialog-initial-focus onClick={() => setIsRegisterOpen(false)} variant="icon">
                ×
              </Button>
            </div>
            <div className="parcel-form modal-parcel-form">
              <div className="modal-field">
                <DropdownField
                  label="ชั้น"
                  value={String(selectedFloor)}
                  onChange={(nextValue) => handleFloorChange(Number(nextValue))}
                  options={floors.map((floor) => ({ value: String(floor), label: `ชั้น ${floor}` }))}
                />
              </div>
              <div className="modal-field">
                <DropdownField
                  label="ห้อง"
                  value={form.roomId}
                  onChange={(nextValue) => setForm((current) => ({ ...current, roomId: nextValue }))}
                  options={floorRooms.map((room) => ({ value: room.id, label: `ห้อง ${room.id}` }))}
                />
              </div>
              <label>
                <span>หมายเหตุ</span>
                <input onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="เช่น กล่องใหญ่ / ซองเอกสาร" value={form.note} />
              </label>
              <label className="parcel-photo-upload">
                <span>รูปพัสดุ</span>
                <input accept="image/*" onChange={(event) => handleImageUpload(event.target.files?.[0])} type="file" />
                <strong><ImageUp size={16} /> {form.imageUrl ? "เลือกรูปแล้ว" : "อัปโหลดรูป"}</strong>
              </label>
            </div>
            <div className="modal-actions">
              <Button onClick={() => setIsRegisterOpen(false)} variant="secondary">
                ยกเลิก
              </Button>
              <Button aria-describedby={!form.roomId ? "parcel-save-disabled-reason" : undefined} disabled={!form.roomId} isLoading={isSaving} loadingLabel="กำลังบันทึก..." onClick={() => void registerParcel()}>
                บันทึกพัสดุ
              </Button>
            </div>
            {!form.roomId ? <p className="disabled-reason justify-self-end" id="parcel-save-disabled-reason">เลือกห้องผู้รับก่อนบันทึกพัสดุ</p> : null}
        </Dialog>
      ) : null}
      {editingParcel && !readOnly ? <Dialog ariaDescribedBy="parcel-edit-description" ariaLabelledBy="parcel-edit-title" onClose={() => setEditingParcel(null)}>
        <header className="modal-header"><div><h2 id="parcel-edit-title">แก้ไขพัสดุห้อง {editingParcel.roomId}</h2><p id="parcel-edit-description">แก้ไขได้เฉพาะรายการที่ยังรอรับ</p></div><Button aria-label="ปิด" onClick={() => setEditingParcel(null)} variant="icon">×</Button></header>
        <label className="modal-field"><span>หมายเหตุ</span><textarea maxLength={1000} onChange={(event) => setEditNote(event.target.value)} rows={4} value={editNote} /></label>
        <footer className="modal-actions"><Button onClick={() => setEditingParcel(null)} variant="secondary">ยกเลิก</Button><Button isLoading={isSaving} onClick={() => void saveParcelEdit()}>บันทึกการแก้ไข</Button></footer>
      </Dialog> : null}
      {confirmationDialog}
    </section>
  );
}
