"use client";
// เก็บฟอร์ม อัปโหลดไฟล์ และโหลดข้อมูลจากเบราว์เซอร์

import { useState } from "react";
import Image from "next/image";
import { Ban, CheckCircle2, ImageUp, PackageCheck, Pencil, Plus } from "lucide-react";
import { DropdownField } from "@/components/dorm/DropdownField";
// ชนิดของพัสดุอยู่ในฮุกเดียวกับการโหลด ส่งต่อให้ที่อื่นใช้ได้เหมือนเดิม
export type { ParcelRecord } from "@/components/dorm/pages/useParcelList";
import { type ParcelRecord, useParcelList } from "@/components/dorm/pages/useParcelList";
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
import { PageHeaderActions } from "@/components/ui/PageHeaderSlot";
import { useActionFeedback } from "@/lib/client/use-action-feedback";

// สองมุมมองของหน้านี้ รอรับกับประวัติที่รับไปแล้ว หน้าแม่เป็นคนบอกว่าอยู่มุมมองไหน
export type ParcelView = "waiting" | "history";


// หน้าพัสดุ ลงทะเบียนพัสดุเข้า และบันทึกตอนผู้เช่ามารับ
export function ParcelsPage({
  activeView,
  initialHasNextPage = false,
  initialParcels,
  initialSummary,
  onChanged,
  propertyId,
  readOnly = false,
  rooms,
}: Readonly<{
  activeView: ParcelView;
  // ส่งมาจาก Server Component ของหน้านี้ มีแล้วก็ไม่ต้องยิงซ้ำตอนเปิดหน้า
  initialHasNextPage?: boolean;
  initialParcels: ParcelRecord[];
  initialSummary?: { today: number; waiting: number; received: number; olderThanThreeDays: number } | null;
  onChanged: () => Promise<void>;
  propertyId: string;
  readOnly?: boolean;
  rooms: Room[];
}>) {
  const notify = useToast();
  const actionFeedback = useActionFeedback();
  const { confirm, confirmationDialog } = useConfirmation();
  const occupiedRooms = rooms.filter((room) => room.status === "occupied");
  const floors = Array.from(new Set(rooms.map((room) => room.floor))).sort((a, b) => a - b);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [editingParcel, setEditingParcel] = useState<ParcelRecord | null>(null);
  const [editNote, setEditNote] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [requestError, setRequestError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  // รายการพัสดุ ตัวเลขสรุป และการแบ่งหน้าฝั่งเซิร์ฟเวอร์ อยู่ในฮุกของตัวเอง
  const { hasNextPage, isLoading, isLoadingMore, loadParcels, parcels, serverPage, summary } = useParcelList({
    initialHasNextPage,
    initialParcels,
    initialSummary,
    onError: setRequestError,
    propertyId,
  });
  const [selectedFloor, setSelectedFloor] = useState(floors[0] ?? 1);
  const [form, setForm] = useState({
    imageUrl: "",
    note: "",
    roomId: occupiedRooms[0]?.id ?? rooms[0]?.id ?? "",
  });
  // เลือกชั้นก่อนแล้วค่อยเลือกห้อง หอที่มีหลายสิบห้องจะได้ไม่ต้องไถหาในรายการเดียว
  const floorRooms = occupiedRooms.filter((room) => room.floor === selectedFloor);

  const waitingParcels = parcels.filter((parcel) => parcel.status === "waiting");
  const receivedParcels = parcels.filter((parcel) => parcel.status === "received");
  // รายการที่ยกเลิกไม่แสดงในทั้งสองมุมมอง เก็บไว้ในฐานข้อมูลเฉย ๆ
  const visibleParcels = activeView === "waiting" ? waitingParcels : receivedParcels;
  const { page, pageItems, setPage, totalPages } = useTablePagination(visibleParcels);

  const registerParcel = async () => {
    setIsSaving(true);
    setRequestError("");
    try {
      // FormData เพราะอาจแนบรูปพัสดุมาด้วย และปล่อยให้เบราว์เซอร์ตั้ง Content-Type เอง
      const payload = new FormData();
      // หน้าจอใช้เลขห้องที่คนอ่านได้ แต่ API ต้องการ id จริงจากฐานข้อมูล
      const room = rooms.find((item) => item.id === form.roomId);
      if (!room?.databaseId) throw new Error("ไม่พบรหัสห้องในฐานข้อมูล");
      payload.set("roomId", room.databaseId);
      if (room.tenantId) payload.set("recipientTenantId", room.tenantId);
      if (form.note.trim()) payload.set("note", form.note.trim());
      if (selectedFile) payload.set("file", selectedFile);
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/parcels`, { method: "POST", body: payload });
      if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error || "ลงทะเบียนพัสดุไม่สำเร็จ");
      // คืนหน่วยความจำของรูปตัวอย่าง เบราว์เซอร์ไม่เก็บกวาด URL พวกนี้ให้เอง
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

  const markReceived = async (parcelId: string) => {
    if (actionFeedback.isPending) return;
    setRequestError("");
    try {
      await actionFeedback.runAction(async () => {
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/parcels/${parcelId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        // แนบเวลาที่แก้ล่าสุดไปด้วย เซิร์ฟเวอร์จะปฏิเสธถ้ามีคนอื่นบันทึกไปก่อนแล้ว
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

  // ยกเลิกรายการที่ลงทะเบียนผิด ผู้เช่าจะไม่เห็นอีก แต่ข้อมูลยังอยู่ในฐาน
  const cancelParcel = async (parcel: ParcelRecord) => {
    // ถามยืนยันก่อน เพราะย้อนกลับไม่ได้
    if (!await confirm({ title: "ยกเลิกรายการพัสดุ?", description: `พัสดุห้อง ${parcel.roomId} จะถูกยกเลิกและไม่แสดงแก่ผู้เช่า การทำรายการนี้ย้อนกลับไม่ได้`, confirmLabel: "ยกเลิกพัสดุ", variant: "danger" })) return;
    setRequestError("");
    try {
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/parcels/${parcel.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "CANCELLED", expectedUpdatedAt: parcel.updatedAt }) });
      if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error || "ยกเลิกพัสดุไม่สำเร็จ");
      await loadParcels(); await onChanged(); notify({ message: "ยกเลิกรายการพัสดุแล้ว" });
    } catch (error) { setRequestError(error instanceof Error ? error.message : "ยกเลิกพัสดุไม่สำเร็จ"); }
  };

  // เปลี่ยนชั้นแล้วเด้งไปห้องแรกของชั้นนั้น เอาห้องที่มีผู้เช่าก่อน เพราะพัสดุมักส่งถึงคนที่อยู่จริง
  const handleFloorChange = (floor: number) => {
    const nextRoom = occupiedRooms.find((room) => room.floor === floor) ?? rooms.find((room) => room.floor === floor);
    setSelectedFloor(floor);
    setForm((current) => ({ ...current, roomId: nextRoom?.id ?? "" }));
  };

  // แสดงรูปตัวอย่างทันทีจากไฟล์ในเครื่อง ไม่ต้องรออัปโหลดขึ้นเซิร์ฟเวอร์ก่อน
  const handleImageUpload = (file: File | undefined) => {
    if (!file) return;
    // คืนหน่วยความจำของรูปเก่าก่อนสร้างใหม่ ไม่งั้นเลือกรูปหลายรอบแล้วรั่วสะสม
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
            <p>{boardSubtitle(activeView, waitingParcels.length, receivedParcels.length)}</p>
          </div>
          <PageHeaderActions>
            {!readOnly ? (
              <button className="primary-button" onClick={() => setIsRegisterOpen(true)} type="button">
                <Plus aria-hidden="true" size={18} /> รับพัสดุใหม่
              </button>
            ) : <span className="badge badge-paid">{waitingParcels.length} รอรับ</span>}
          </PageHeaderActions>
        </div>

        <ParcelTable
          actionFeedback={actionFeedback}
          activeView={activeView}
          isLoading={isLoading}
          onCancel={cancelParcel}
          onEdit={(parcel) => { setEditingParcel(parcel); setEditNote(parcel.note); }}
          onMarkReceived={markReceived}
          parcels={pageItems}
          readOnly={readOnly}
        />
        <TablePagination page={page} setPage={setPage} totalItems={visibleParcels.length} totalPages={totalPages} />
        {hasNextPage ? <LoadMoreButton isLoading={isLoadingMore} label="โหลดพัสดุเพิ่มเติม" onClick={() => void loadParcels(serverPage + 1, true)} /> : null}
      </article>

      <ParcelRegisterDialog
        floorRooms={floorRooms}
        floors={floors}
        form={form}
        isOpen={isRegisterOpen && !readOnly}
        isSaving={isSaving}
        onClose={() => setIsRegisterOpen(false)}
        onFloorChange={handleFloorChange}
        onImageUpload={handleImageUpload}
        onNoteChange={(note) => setForm((current) => ({ ...current, note }))}
        onRoomChange={(roomId) => setForm((current) => ({ ...current, roomId }))}
        onSubmit={registerParcel}
        selectedFloor={selectedFloor}
      />
      {editingParcel && !readOnly ? <Dialog ariaDescribedBy="parcel-edit-description" ariaLabelledBy="parcel-edit-title" className="modal-sm" onClose={() => setEditingParcel(null)}>
        <header className="modal-header"><div><h2 id="parcel-edit-title">แก้ไขพัสดุห้อง {editingParcel.roomId}</h2><p id="parcel-edit-description">แก้ไขได้เฉพาะรายการที่ยังรอรับ</p></div><Button aria-label="ปิด" onClick={() => setEditingParcel(null)} variant="icon">×</Button></header>
        <label className="modal-field"><span>หมายเหตุ</span><textarea maxLength={1000} onChange={(event) => setEditNote(event.target.value)} rows={4} value={editNote} /></label>
        <footer className="modal-actions"><Button onClick={() => setEditingParcel(null)} variant="secondary">ยกเลิก</Button><Button isLoading={isSaving} onClick={() => void saveParcelEdit()}>บันทึกการแก้ไข</Button></footer>
      </Dialog> : null}
      {confirmationDialog}
    </section>
  );
}

// คำบรรยายใต้หัวกระดาน ต่างกันตามมุมมองที่เปิดอยู่
function boardSubtitle(activeView: ParcelView, waitingCount: number, receivedCount: number) {
  return activeView === "waiting"
    ? `${waitingCount} รายการรอรับ · กดรับแล้วเมื่อส่งมอบแล้ว`
    : `${receivedCount} รายการรับแล้ว`;
}

// ตารางพัสดุ แยกกรณีกำลังโหลดและยังไม่มีรายการออกจากตารางจริง
function ParcelTable({ actionFeedback, activeView, isLoading, onCancel, onEdit, onMarkReceived, parcels, readOnly }: Readonly<{
  actionFeedback: ReturnType<typeof useActionFeedback>;
  activeView: ParcelView;
  isLoading: boolean;
  onCancel: (parcel: ParcelRecord) => Promise<void>;
  onEdit: (parcel: ParcelRecord) => void;
  onMarkReceived: (parcelId: string) => Promise<void>;
  parcels: ParcelRecord[];
  readOnly: boolean;
}>) {
  if (isLoading) return <LoadingSkeleton columns={6} count={4} label="กำลังโหลดรายการพัสดุ" variant="table" />;
  if (parcels.length === 0) return <ParcelEmptyState activeView={activeView} />;
  return <div className="parcel-table-wrap">
    <table className="parcel-table status-scan-table">
      <thead>
        <tr><th scope="col">พัสดุ</th><th scope="col">ห้อง / ผู้รับ</th><th scope="col">หมายเหตุ</th><th scope="col">วันที่ลงทะเบียน</th><th scope="col">สถานะ</th><th scope="col">จัดการ</th></tr>
      </thead>
      <tbody>
        {parcels.map((parcel) => <ParcelRow
          actionFeedback={actionFeedback}
          key={parcel.id}
          onCancel={onCancel}
          onEdit={onEdit}
          onMarkReceived={onMarkReceived}
          parcel={parcel}
          readOnly={readOnly}
        />)}
      </tbody>
    </table>
  </div>;
}

function ParcelEmptyState({ activeView }: Readonly<{ activeView: ParcelView }>) {
  if (activeView === "waiting") {
    return <div className="repair-empty">
      <strong>ยังไม่มีพัสดุรอรับ</strong><p>พัสดุที่ลงทะเบียนแล้วจะแสดงที่นี่จนกว่าผู้เช่าจะมารับ</p>
      <span>กดเพิ่มพัสดุเพื่อบันทึกรายการใหม่</span>
    </div>;
  }
  return <div className="repair-empty">
    <strong>ยังไม่มีประวัติรับพัสดุ</strong><p>พัสดุที่ผู้เช่ารับไปแล้วจะย้ายมาที่นี่</p>
    <span>รายการจะย้ายมาที่นี่หลังจากกดรับแล้ว</span>
  </div>;
}

function ParcelRow({ actionFeedback, onCancel, onEdit, onMarkReceived, parcel, readOnly }: Readonly<{
  actionFeedback: ReturnType<typeof useActionFeedback>;
  onCancel: (parcel: ParcelRecord) => Promise<void>;
  onEdit: (parcel: ParcelRecord) => void;
  onMarkReceived: (parcelId: string) => Promise<void>;
  parcel: ParcelRecord;
  readOnly: boolean;
}>) {
  // จัดการได้เฉพาะรายการที่ยังรอรับ และต้องไม่ได้อยู่ในโหมดอ่านอย่างเดียว
  const canManage = parcel.status === "waiting" && !readOnly;
  return <tr data-status={parcel.status}>
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
      {canManage ? <ActionMenu items={[
        { disabled: actionFeedback.isPending, id: "received", label: actionFeedback.isPending ? "กำลังบันทึก..." : "บันทึกว่ารับแล้ว", icon: <CheckCircle2 size={16} />, onSelect: () => void onMarkReceived(parcel.id) },
        { id: "edit", label: "แก้ไขหมายเหตุ", icon: <Pencil size={16} />, onSelect: () => onEdit(parcel) },
        { id: "cancel", label: "ยกเลิกรายการ", icon: <Ban size={16} />, variant: "danger", onSelect: () => void onCancel(parcel) },
      ]} label={`จัดการพัสดุห้อง ${parcel.roomId}`} /> : <span className="parcel-muted">—</span>}
    </td>
  </tr>;
}

type ParcelForm = { imageUrl: string; note: string; roomId: string };

// กล่องลงทะเบียนพัสดุใหม่ เลือกชั้นก่อนแล้วค่อยเลือกห้อง
function ParcelRegisterDialog({ floorRooms, floors, form, isOpen, isSaving, onClose, onFloorChange, onImageUpload, onNoteChange, onRoomChange, onSubmit, selectedFloor }: Readonly<{
  floorRooms: Room[];
  floors: number[];
  form: ParcelForm;
  isOpen: boolean;
  isSaving: boolean;
  onClose: () => void;
  onFloorChange: (floor: number) => void;
  onImageUpload: (file: File | undefined) => void;
  onNoteChange: (note: string) => void;
  onRoomChange: (roomId: string) => void;
  onSubmit: () => Promise<void>;
  selectedFloor: number;
}>) {
  if (!isOpen) return null;
  return <Dialog ariaDescribedBy="parcel-register-description" ariaLabelledBy="parcel-register-title" className="repair-flow-modal" closeOnBackdrop onClose={onClose}>
    <div className="modal-header">
      <div>
        <small id="parcel-register-description">ลงทะเบียนพัสดุเข้าหอ</small>
        <h2 id="parcel-register-title">เพิ่มพัสดุใหม่</h2>
      </div>
      <Button aria-label="ปิด" data-dialog-initial-focus onClick={onClose} variant="icon">×</Button>
    </div>
    <div className="parcel-form modal-parcel-form">
      <div className="modal-field">
        <DropdownField label="ชั้น" onChange={(nextValue) => onFloorChange(Number(nextValue))} options={floors.map((floor) => ({ value: String(floor), label: `ชั้น ${floor}` }))} value={String(selectedFloor)} />
      </div>
      <div className="modal-field">
        <DropdownField label="ห้อง" onChange={onRoomChange} options={floorRooms.map((room) => ({ value: room.id, label: `ห้อง ${room.id}` }))} value={form.roomId} />
      </div>
      <label>
        <span>หมายเหตุ</span>
        <input onChange={(event) => onNoteChange(event.target.value)} placeholder="เช่น กล่องใหญ่ / ซองเอกสาร" value={form.note} />
      </label>
      <label className="parcel-photo-upload">
        <span>รูปพัสดุ</span>
        <input accept="image/*" onChange={(event) => onImageUpload(event.target.files?.[0])} type="file" />
        <strong><ImageUp size={16} /> {form.imageUrl ? "เลือกรูปแล้ว" : "อัปโหลดรูป"}</strong>
      </label>
    </div>
    <div className="modal-actions">
      <Button onClick={onClose} variant="secondary">ยกเลิก</Button>
      <Button aria-describedby={form.roomId ? undefined : "parcel-save-disabled-reason"} disabled={!form.roomId} isLoading={isSaving} loadingLabel="กำลังบันทึก..." onClick={() => void onSubmit()}>บันทึกพัสดุ</Button>
    </div>
    {form.roomId ? null : <p className="disabled-reason justify-self-end" id="parcel-save-disabled-reason">เลือกห้องผู้รับก่อนบันทึกพัสดุ</p>}
  </Dialog>;
}
