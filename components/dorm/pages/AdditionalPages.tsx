"use client";
// เก็บฟอร์มและสถานะของกล่องโต้ตอบไว้ฝั่งเบราว์เซอร์

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Building2,
  Ban,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Megaphone,
  MessageSquare,
  MessageSquareWarning,
  Plus,
  Pencil,
  Search,
  UsersRound,
} from "lucide-react";
import { ConfirmationDialog } from "@/components/dorm/ConfirmationDialog";
import { DatePickerField } from "@/components/dorm/DatePickerField";
import { DropdownField } from "@/components/dorm/DropdownField";
import { ReadOnlyNotice } from "@/components/dorm/ReadOnlyNotice";
import { TablePagination, useTablePagination } from "@/components/dorm/TablePagination";
import { TicketReplyThread } from "@/components/dorm/TicketReplyThread";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { IconButton } from "@/components/ui/IconButton";
import { LoadMoreButton } from "@/components/ui/DataNavigation";
import { SearchEmptyState } from "@/components/ui/SearchEmptyState";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { useConfirmation } from "@/components/ui/use-confirmation";
import { useToast } from "@/components/ui/ToastProvider";
import { PageHeaderActions } from "@/components/ui/PageHeaderSlot";
import { ownerPagePath } from "@/lib/navigation-routes";
import { platformProfile } from "@/lib/platform-profile";
import type { Room } from "@/types/dorm";

// ขอบเขตผู้รับประกาศ ไล่จากกว้างไปแคบ ทั้งหอ อาคาร ชั้น หรือระบุห้อง
type AnnouncementAudience = "ALL_TENANTS" | "BUILDING" | "FLOOR" | "ROOM";

// ประกาศหนึ่งรายการ
export type Announcement = {
  audience: string;
  audienceType?: AnnouncementAudience;
  buildingId?: string;
  floorId?: string;
  roomIds?: string[];
  content: string;
  date: string;
  id: string;
  status: "เผยแพร่แล้ว" | "ตั้งเวลา" | "ฉบับร่าง";
  title: string;
  // ส่งกลับไปตอนแก้ไข เซิร์ฟเวอร์จะปฏิเสธถ้ามีคนอื่นแก้ไปก่อนแล้ว กันแก้ทับกัน
  updatedAt?: string;
  // มีค่าเฉพาะประกาศที่ตั้งเวลาไว้ ประกาศที่เผยแพร่ทันทีเป็น null
  publishAt?: string | null;
};

// วันนี้ในรูปแบบ "YYYY-MM-DD" ตามเวลาของเครื่องผู้ใช้
// ต้องหักเขตเวลาออกก่อน เพราะ toISOString แปลงเป็น UTC ซึ่งอาจกลายเป็นเมื่อวานสำหรับคนไทย
function todayInputValue() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

// หน้าประกาศ ส่งถึงทั้งหอหรือเจาะจงอาคาร ชั้น หรือห้อง และตั้งเวลาเผยแพร่ได้
export function AnnouncementsPage({ initialAnnouncements, initialLoaded = false, onChanged, propertyId, readOnly = false, recipientRoomCount, rooms }: Readonly<{
  initialAnnouncements: Announcement[];
  // true = เซิร์ฟเวอร์ส่งรายการมาให้แล้ว ไม่ต้องยิงซ้ำตอนเปิดหน้า
  initialLoaded?: boolean;
  onChanged: () => Promise<void>;
  propertyId: string;
  readOnly?: boolean;
  recipientRoomCount: number;
  rooms: Room[];
}>) {
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [announcementToDelete, setAnnouncementToDelete] = useState<Announcement | null>(null);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [serverPage, setServerPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [summary, setSummary] = useState({ total: 0, published: 0, scheduled: 0, draft: 0 });
  const [form, setForm] = useState({
    audience: "ALL_TENANTS" as AnnouncementAudience,
    buildingId: "",
    floorId: "",
    roomIds: [] as string[],
    content: "",
    publishDate: todayInputValue(),
    publishMode: "now" as "now" | "scheduled",
    title: "",
  });
  const { page, pageItems, setPage, totalPages } = useTablePagination(announcements);

  const loadAnnouncements = useCallback(async (targetPage = 1, append = false) => {
    if (append) setIsLoadingMore(true);
    setFormError("");
    try {
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/announcements?page=${targetPage}&pageSize=50`, { cache: "no-store" });
      const payload = await response.json() as {
        data?: Array<{
          id: string; title: string; content: string; audience: string; status: string;
          publishAt: string | null; publishedAt: string | null; createdAt: string; updatedAt: string;
          rooms: Array<{ room: { number: string } }>;
          building: { id: string; name: string; code: string } | null;
          floor: { id: string; number: number; label: string | null; buildingId: string } | null;
        }>;
        error?: string;
        pageInfo?: { page: number; hasNextPage: boolean };
        summary?: { total: number; published: number; scheduled: number; draft: number };
      };
      if (!response.ok || !payload.data || !payload.pageInfo || !payload.summary) throw new Error(payload.error || "โหลดประกาศไม่สำเร็จ");
      const mapped: Announcement[] = payload.data.map((item) => ({
        id: item.id,
        title: item.title,
        content: item.content,
        audience: audienceLabel(item),
        audienceType: item.audience as AnnouncementAudience,
        buildingId: item.building?.id,
        floorId: item.floor?.id,
        roomIds: item.rooms.map(({ room }) => rooms.find((candidate) => candidate.id === room.number)?.databaseId).filter((id): id is string => Boolean(id)),
        date: new Date(item.publishAt ?? item.publishedAt ?? item.createdAt).toLocaleString("th-TH"),
        status: announcementStatusLabels[item.status] ?? "เผยแพร่แล้ว",
        updatedAt: item.updatedAt,
        publishAt: item.publishAt,
      }));
      setAnnouncements((current) => append ? [...current, ...mapped] : mapped);
      setServerPage(payload.pageInfo.page);
      setHasNextPage(payload.pageInfo.hasNextPage);
      setSummary(payload.summary);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "โหลดประกาศไม่สำเร็จ");
    } finally {
      setIsLoadingMore(false);
    }
  }, [propertyId, rooms]);

  // ล้างฟอร์มกลับเป็นค่าเริ่มต้น ใช้ทั้งตอนเปิดฟอร์มใหม่และตอนบันทึกเสร็จ
  const resetForm = () => {
    setForm({ audience: "ALL_TENANTS", buildingId: "", floorId: "", roomIds: [], content: "", publishDate: todayInputValue(), publishMode: "now", title: "" });
    setFormError("");
    setEditingId(null);
  };

  const openCreateForm = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  // เปิดฟอร์มพร้อมค่าเดิมของประกาศที่เลือก
  const openEditForm = (announcement: Announcement) => {
    setEditingId(announcement.id);
    setForm({
      audience: announcement.audienceType ?? "ALL_TENANTS",
      buildingId: announcement.buildingId ?? "",
      floorId: announcement.floorId ?? "",
      roomIds: announcement.roomIds ?? [],
      content: announcement.content,
      publishDate: announcement.publishAt?.slice(0, 10) ?? todayInputValue(),
      // ประกาศที่เผยแพร่ไปแล้วเปิดมาเป็นโหมดทันที ไม่ใช่ตั้งเวลา เพราะเวลาเดิมผ่านไปแล้ว
      publishMode: announcement.status === "ตั้งเวลา" ? "scheduled" : "now",
      title: announcement.title,
    });
    setFormError("");
    setIsCreateOpen(true);
  };

  const skipInitialLoadRef = useRef(initialLoaded);
  useEffect(() => {
    if (skipInitialLoadRef.current) {
      skipInitialLoadRef.current = false;
      return;
    }
    void loadAnnouncements();
  }, [loadAnnouncements]);

  // ใช้ตัวเดียวกันทั้งสร้างและแก้ไข ต่างกันที่ URL กับเมท็อด
  const saveAnnouncement = async () => {
    const title = form.title.trim();
    const content = form.content.trim();
    if (!title || !content) {
      setFormError("กรุณากรอกหัวข้อและเนื้อหาประกาศ");
      return;
    }
    if (form.publishMode === "scheduled" && !form.publishDate) {
      setFormError("กรุณาเลือกวันที่เผยแพร่");
      return;
    }
    if (isAudienceIncomplete(form)) {
      setFormError("กรุณาเลือกกลุ่มผู้รับประกาศให้ครบ");
      return;
    }

    setIsSaving(true);
    try {
      const current = editingId ? announcements.find((item) => item.id === editingId) : undefined;
      await saveAnnouncementRequest(propertyId, { content, editingId, expectedUpdatedAt: current?.updatedAt, form, title });
      resetForm();
      setIsCreateOpen(false);
      await loadAnnouncements();
      await onChanged();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "บันทึกประกาศไม่สำเร็จ");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteAnnouncement = (announcement: Announcement) => {
    setAnnouncementToDelete(announcement);
  };

  // ไม่ได้ลบจริง แต่เปลี่ยนสถานะเป็น ARCHIVED เพื่อให้ตรวจย้อนหลังได้
  const archiveAnnouncement = async (announcement: Announcement) => {
    try {
      await archiveAnnouncementRequest(propertyId, announcement);
      setAnnouncementToDelete(null);
      await loadAnnouncements();
      await onChanged();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "เก็บประกาศไม่สำเร็จ");
    }
  };

  return (
    <section className="additional-page">
      {readOnly ? <ReadOnlyNotice>ดูประกาศ สถานะ กลุ่มผู้รับ และโหลดรายการเพิ่มเติมได้ แต่ไม่สามารถสร้าง แก้ไข หรือลบประกาศ</ReadOnlyNotice> : null}
      <div className="figma-summary-grid four">
        <Summary label="ประกาศทั้งหมด" value={`${summary.total} รายการ`} icon={<Megaphone size={20} />} tone="indigo" />
        <Summary label="เผยแพร่แล้ว" value={`${summary.published} รายการ`} icon={<CheckCircle2 size={20} />} tone="green" />
        <Summary label="ตั้งเวลา" value={`${summary.scheduled} รายการ`} icon={<Clock3 size={20} />} tone="orange" />
        <Summary label="ผู้รับทั้งหมด" value={`${recipientRoomCount} ห้อง`} icon={<UsersRound size={20} />} tone="blue" />
      </div>
      <article className="figma-table-card">
        <PageHeaderActions>
          {!readOnly ? (
            <button className="primary-button" onClick={openCreateForm} type="button">
              <Plus aria-hidden="true" size={18} /> สร้างประกาศ
            </button>
          ) : null}
        </PageHeaderActions>
        <AnnouncementTable items={pageItems} onDelete={deleteAnnouncement} onEdit={openEditForm} readOnly={readOnly} />
        <TablePagination page={page} setPage={setPage} totalItems={announcements.length} totalPages={totalPages} />
        {hasNextPage ? <LoadMoreButton isLoading={isLoadingMore} label="โหลดประกาศเพิ่มเติม" onClick={() => void loadAnnouncements(serverPage + 1, true)} /> : null}
      </article>
      <AnnouncementFormDialog
        editingId={editingId}
        form={form}
        formError={formError}
        isOpen={isCreateOpen}
        isSaving={isSaving}
        onClose={() => { resetForm(); setIsCreateOpen(false); }}
        onSubmit={saveAnnouncement}
        recipientRoomCount={recipientRoomCount}
        rooms={rooms}
        setForm={setForm}
        setFormError={setFormError}
      />
      {announcementToDelete ? <ConfirmationDialog
        confirmLabel="ลบประกาศ"
        description={`ประกาศ “${announcementToDelete.title}” จะถูกลบออกจากรายการ`}
        onCancel={() => setAnnouncementToDelete(null)}
        onConfirm={() => void archiveAnnouncement(announcementToDelete)}
        title="ลบประกาศนี้หรือไม่?"
        variant="danger"
      /> : null}
    </section>
  );
}

type AnnouncementForm = {
  audience: AnnouncementAudience;
  buildingId: string;
  floorId: string;
  roomIds: string[];
  content: string;
  publishDate: string;
  publishMode: "now" | "scheduled";
  title: string;
};

// เลือกขอบเขตแบบเจาะจงแล้วต้องระบุด้วยว่าอาคารไหน ชั้นไหน หรือห้องไหน
function isAudienceIncomplete(form: AnnouncementForm) {
  if (form.audience === "BUILDING") return !form.buildingId;
  if (form.audience === "FLOOR") return !form.floorId;
  if (form.audience === "ROOM") return form.roomIds.length === 0;
  return false;
}

// จำนวนห้องที่จะได้รับประกาศตามขอบเขตที่เลือกไว้
function recipientCount(form: AnnouncementForm, rooms: Room[], allTenantsCount: number) {
  if (form.audience === "ALL_TENANTS") return allTenantsCount;
  if (form.audience === "BUILDING") return rooms.filter((room) => room.status === "occupied" && room.buildingId === form.buildingId).length;
  if (form.audience === "FLOOR") return rooms.filter((room) => room.status === "occupied" && room.floorId === form.floorId).length;
  return form.roomIds.length;
}

// สร้างหรือแก้ไขประกาศ แก้ไขใช้ PATCH ไปที่ id เดิม ส่วนสร้างใหม่ใช้ POST
async function saveAnnouncementRequest(propertyId: string, { content, editingId, expectedUpdatedAt, form, title }: {
  content: string;
  editingId: string | null;
  expectedUpdatedAt: string | undefined;
  form: AnnouncementForm;
  title: string;
}) {
  // แก้ประกาศเดิมยิงไปที่ id ของประกาศนั้น ส่วนประกาศใหม่ยิงไปที่ตัวรายการ
  const path = editingId ? `/announcements/${editingId}` : "/announcements";
  const response = await fetch(`/api/v1/admin/properties/${propertyId}${path}`, {
    method: editingId ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      content,
      audience: form.audience,
      buildingId: form.audience === "BUILDING" ? form.buildingId : undefined,
      floorId: form.audience === "FLOOR" ? form.floorId : undefined,
      roomIds: form.audience === "ROOM" ? form.roomIds : [],
      status: form.publishMode === "now" ? "PUBLISHED" : "SCHEDULED",
      // ตั้งเวลาไว้ 9 โมงเช้าตามเวลาไทย เพราะฟอร์มให้เลือกแค่วัน ไม่ได้ให้เลือกเวลา
      ...(form.publishMode === "scheduled" ? { publishAt: new Date(`${form.publishDate}T09:00:00+07:00`).toISOString() } : {}),
      // แก้ไขต้องแนบเวลาที่แก้ล่าสุดไปด้วย สร้างใหม่ไม่ต้องเพราะยังไม่มีของเดิมให้ชน
      ...(editingId ? { expectedUpdatedAt } : {}),
    }),
  });
  if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error || "บันทึกประกาศไม่สำเร็จ");
}

// ไม่ได้ลบจริง แต่เปลี่ยนสถานะเป็น ARCHIVED เพื่อให้ตรวจย้อนหลังได้
async function archiveAnnouncementRequest(propertyId: string, announcement: Announcement) {
  const response = await fetch(`/api/v1/admin/properties/${propertyId}/announcements/${announcement.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "ARCHIVED", expectedUpdatedAt: announcement.updatedAt }),
  });
  if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error || "เก็บประกาศไม่สำเร็จ");
}

// ตารางประกาศทั้งหมดของหอ
function AnnouncementTable({ items, onDelete, onEdit, readOnly }: Readonly<{
  items: Announcement[];
  onDelete: (announcement: Announcement) => void;
  onEdit: (announcement: Announcement) => void;
  readOnly: boolean;
}>) {
  return <div className="figma-table-wrap">
    <table className="figma-table">
      <thead><tr><th scope="col">หัวข้อ</th><th scope="col">กลุ่มผู้รับ</th><th scope="col">วันที่เผยแพร่</th><th scope="col">สถานะ</th><th scope="col">จัดการ</th></tr></thead>
      <tbody>{items.map((item) => <tr key={item.id}>
        <td><strong>{item.title}</strong></td>
        <td>{item.audience}</td>
        <td>{item.date}</td>
        <td><span className={`badge ${item.status === "เผยแพร่แล้ว" ? "badge-paid" : "badge-pending"}`}>{item.status}</span></td>
        <td>
          {!readOnly ? <ActionMenu
            items={[
              { id: "edit", label: "แก้ไข", onSelect: () => onEdit(item) },
              { id: "delete", label: "ลบ", onSelect: () => onDelete(item), variant: "danger" },
            ]}
            label={`จัดการประกาศ ${item.title}`}
          /> : null}
        </td>
      </tr>)}</tbody>
    </table>
  </div>;
}

// ช่องเลือกขอบเขตผู้รับ เปลี่ยนตามกลุ่มที่เลือกไว้
function AudienceScopeField({ form, rooms, setForm }: Readonly<{
  form: AnnouncementForm;
  rooms: Room[];
  setForm: React.Dispatch<React.SetStateAction<AnnouncementForm>>;
}>) {
  if (form.audience === "BUILDING") {
    const options = Array.from(new Map(rooms.flatMap((room) => room.buildingId ? [[room.buildingId, { label: room.buildingName ?? room.buildingId, value: room.buildingId }] as const] : [])).values());
    return <DropdownField label="อาคาร" onChange={(buildingId) => setForm((current) => ({ ...current, buildingId }))} options={options} value={form.buildingId} />;
  }
  if (form.audience === "FLOOR") {
    const options = Array.from(new Map(rooms.flatMap((room) => room.floorId ? [[room.floorId, { label: `${room.buildingName ?? "อาคาร"} · ชั้น ${room.floor}`, value: room.floorId }] as const] : [])).values());
    return <DropdownField label="ชั้น" onChange={(floorId) => setForm((current) => ({ ...current, floorId }))} options={options} value={form.floorId} />;
  }
  if (form.audience === "ROOM") {
    const selectable = rooms.filter((room) => room.databaseId && room.status === "occupied");
    return <fieldset>
      <legend>ห้องที่ได้รับประกาศ</legend>
      <div className="max-h-48 overflow-y-auto rounded-xl border border-[#d7d8df] p-3">
        {selectable.map((room) => <label className="flex items-center gap-2 py-1" key={room.databaseId}>
          <input checked={form.roomIds.includes(room.databaseId!)} onChange={(event) => setForm((current) => ({
            ...current,
            roomIds: event.target.checked ? [...current.roomIds, room.databaseId!] : current.roomIds.filter((id) => id !== room.databaseId),
          }))} type="checkbox" />
          ห้อง {room.id} · {room.buildingName ?? "-"} ชั้น {room.floor}
        </label>)}
      </div>
    </fieldset>;
  }
  return null;
}

// กล่องสร้างหรือแก้ไขประกาศ
function AnnouncementFormDialog({ editingId, form, formError, isOpen, isSaving, onClose, onSubmit, recipientRoomCount, rooms, setForm, setFormError }: Readonly<{
  editingId: string | null;
  form: AnnouncementForm;
  formError: string;
  isOpen: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  recipientRoomCount: number;
  rooms: Room[];
  setForm: React.Dispatch<React.SetStateAction<AnnouncementForm>>;
  setFormError: (message: string) => void;
}>) {
  if (!isOpen) return null;

  const editField = (patch: Partial<AnnouncementForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setFormError("");
  };

  return <Dialog ariaDescribedBy="create-announcement-description" ariaLabelledBy="create-announcement-title" className="modal-md" onClose={onClose}>
    <form className="modal-form" onSubmit={(event) => { event.preventDefault(); void onSubmit(); }}>
      <header className="modal-header">
        <div><h2 id="create-announcement-title">{editingId ? "แก้ไขประกาศ" : "สร้างประกาศใหม่"}</h2><p id="create-announcement-description">กำหนดเนื้อหา กลุ่มผู้รับ และเวลาที่ต้องการเผยแพร่</p></div>
        <IconButton label="ปิด" onClick={onClose} tooltip="ปิดหน้าต่างประกาศ">×</IconButton>
      </header>

      <label>
        <span>หัวข้อประกาศ</span>
        <input maxLength={120} onChange={(event) => editField({ title: event.target.value })} placeholder="เช่น แจ้งปิดน้ำชั่วคราว" required value={form.title} />
      </label>

      <label>
        <span>เนื้อหาประกาศ</span>
        <textarea maxLength={2000} onChange={(event) => editField({ content: event.target.value })} placeholder="รายละเอียดที่ต้องการแจ้งผู้เช่า" required rows={6} value={form.content} />
      </label>

      <DropdownField
        label="กลุ่มผู้รับ"
        onChange={(audience) => setForm((current) => ({ ...current, audience: audience as AnnouncementAudience, buildingId: "", floorId: "", roomIds: [] }))}
        options={[{ label: "ผู้เช่าทุกห้อง", value: "ALL_TENANTS" }, { label: "เฉพาะอาคาร", value: "BUILDING" }, { label: "เฉพาะชั้น", value: "FLOOR" }, { label: "เลือกห้อง", value: "ROOM" }]}
        value={form.audience}
      />

      <AudienceScopeField form={form} rooms={rooms} setForm={setForm} />
      <p className="text-sm text-[#73757d]">ผู้รับประมาณ {recipientCount(form, rooms, recipientRoomCount)} ห้อง</p>

      <fieldset>
        <legend>การเผยแพร่</legend>
        <label>
          <input checked={form.publishMode === "now"} name="publishMode" onChange={() => setForm((current) => ({ ...current, publishMode: "now" }))} type="radio" />
          เผยแพร่ทันที
        </label>
        <label>
          <input checked={form.publishMode === "scheduled"} name="publishMode" onChange={() => setForm((current) => ({ ...current, publishMode: "scheduled" }))} type="radio" />
          ตั้งเวลาเผยแพร่
        </label>
      </fieldset>

      {form.publishMode === "scheduled" ? <DatePickerField
        label="วันที่เผยแพร่"
        onChange={(value) => setForm((current) => ({ ...current, publishDate: value }))}
        value={form.publishDate}
      /> : null}

      {formError ? <p role="alert">{formError}</p> : null}

      <footer className="modal-actions">
        <button onClick={onClose} type="button">ยกเลิก</button>
        <button disabled={isSaving} type="submit">{announcementSubmitLabel(editingId, isSaving)}</button>
      </footer>
    </form>
  </Dialog>;
}

function announcementSubmitLabel(editingId: string | null, isSaving: boolean) {
  if (isSaving) return "กำลังบันทึก...";
  return editingId ? "บันทึกการแก้ไข" : "สร้างประกาศ";
}

// กลุ่มผู้รับประกาศ เจาะจงอาคารหรือชั้นก็บอกชื่อไปเลย เลือกทีละห้องก็บอกจำนวน
function audienceLabel(item: {
  audience: string;
  building?: { name: string } | null;
  floor?: { label: string | null; number: number } | null;
  rooms: unknown[];
}) {
  if (item.audience === "ALL_TENANTS") return "ผู้เช่าทุกห้อง";
  if (item.audience === "BUILDING") return `อาคาร ${item.building?.name ?? "-"}`;
  if (item.audience === "FLOOR") return item.floor?.label ?? `ชั้น ${item.floor?.number ?? "-"}`;
  return `${item.rooms.length} ห้อง`;
}

// ค่าใน enum ของฐานข้อมูลเป็นตัวพิมพ์ใหญ่ ส่วนหน้าจอใช้คำไทย เก็บเป็นตารางแทนบันได ternary
const announcementStatusLabels: Record<string, Announcement["status"]> = {
  SCHEDULED: "ตั้งเวลา",
  DRAFT: "ฉบับร่าง",
};

const complaintStatusLabels: Record<string, Complaint["status"]> = {
  RESOLVED: "แก้ไขแล้ว",
  CANCELLED: "ยกเลิกแล้ว",
  ACKNOWLEDGED: "กำลังตรวจสอบ",
  IN_PROGRESS: "กำลังตรวจสอบ",
};

// เลื่อนสถานะทีละขั้น สถานะที่ไม่อยู่ในตารางแปลว่าปิดงานไปแล้ว ไม่มีขั้นถัดไป
const nextComplaintStatus: Record<string, string> = {
  "รับเรื่องแล้ว": "ACKNOWLEDGED",
  "กำลังตรวจสอบ": "RESOLVED",
};

export type Complaint = {
  id: string;
  title: string;
  room: string;
  owner: string;
  date: string;
  hasUnreadReply?: boolean;
  status: "รับเรื่องแล้ว" | "กำลังตรวจสอบ" | "แก้ไขแล้ว" | "ยกเลิกแล้ว";
  detail?: string;
  priority?: "NORMAL" | "URGENT";
  updatedAt?: string;
};

// หน้าเรื่องร้องเรียน ไล่สถานะจากรับเรื่อง ไปตรวจสอบ แล้วปิดงาน
export function ComplaintsPage({
  complaints: initialComplaints,
  initialLoaded = false,
  onChanged,
  onAddRequestHandled,
  openAddOnMount,
  onUnreadChanged,
  propertyId,
  readOnly = false,
}: Readonly<{
  // true = เซิร์ฟเวอร์ส่งรายการมาให้แล้ว ไม่ต้องยิงซ้ำตอนเปิดหน้า
  initialLoaded?: boolean;
  complaints: Complaint[];
  onChanged: () => Promise<void>;
  onAddRequestHandled: () => void;
  openAddOnMount: boolean;
  onUnreadChanged: () => Promise<void>;
  propertyId: string;
  readOnly?: boolean;
}>) {
  const [complaints, setComplaints] = useState(initialComplaints);
  const [formError, setFormError] = useState("");
  const [serverPage, setServerPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [replyTicketId, setReplyTicketId] = useState<string | null>(null);
  const [editingComplaint, setEditingComplaint] = useState<Complaint | null>(null);
  const [editForm, setEditForm] = useState({ title: "", detail: "", priority: "NORMAL" as "NORMAL" | "URGENT" });
  const [isSaving, setIsSaving] = useState(false);
  const { confirm, confirmationDialog } = useConfirmation();
  const notify = useToast();
  const { page, pageItems, setPage, totalPages } = useTablePagination(complaints);

  const loadComplaints = useCallback(async (targetPage = 1, append = false) => {
    if (append) setIsLoadingMore(true);
    setFormError("");
    try {
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/tickets?type=COMPLAINT&page=${targetPage}&pageSize=50`, { cache: "no-store" });
      const payload = await response.json() as {
        data?: Array<{
          id: string; title: string; detail: string; priority: "NORMAL" | "URGENT"; status: string; createdAt: string; updatedAt: string; hasUnreadReply: boolean;
          room: { number: string } | null;
          tenantProfile: { user: { displayName: string } } | null;
        }>;
        error?: string;
        pageInfo?: { page: number; hasNextPage: boolean };
      };
      if (!response.ok || !payload.data || !payload.pageInfo) throw new Error(payload.error || "โหลดเรื่องร้องเรียนไม่สำเร็จ");
      const mapped: Complaint[] = payload.data.map((item) => ({
        id: item.id,
        title: item.title,
        room: item.room?.number ?? "-",
        owner: item.tenantProfile?.user.displayName ?? "ไม่ระบุชื่อ",
        date: new Date(item.createdAt).toLocaleString("th-TH"),
        hasUnreadReply: item.hasUnreadReply,
        status: complaintStatusLabels[item.status] ?? "รับเรื่องแล้ว",
        detail: item.detail, priority: item.priority, updatedAt: item.updatedAt,
      }));
      setComplaints((current) => append ? [...current, ...mapped] : mapped);
      setServerPage(payload.pageInfo.page);
      setHasNextPage(payload.pageInfo.hasNextPage);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "โหลดเรื่องร้องเรียนไม่สำเร็จ");
    } finally {
      setIsLoadingMore(false);
    }
  }, [propertyId]);

  const skipInitialComplaintsRef = useRef(initialLoaded);
  useEffect(() => {
    if (skipInitialComplaintsRef.current) {
      skipInitialComplaintsRef.current = false;
      return;
    }
    void loadComplaints();
    if (openAddOnMount) onAddRequestHandled();
  }, [loadComplaints, onAddRequestHandled, openAddOnMount]);

  // เลื่อนไปสถานะถัดไปทีละขั้น ปุ่มเดียวไม่ต้องให้ผู้ใช้เลือกเองว่าจะไปสถานะไหน
  const advanceStatus = async (complaint: Complaint) => {
    const status = nextComplaintStatus[complaint.status] ?? null;
    // ปิดงานไปแล้วก็ไม่มีขั้นถัดไป
    if (!status) return;
    setFormError("");
    try {
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/tickets/${complaint.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, expectedUpdatedAt: complaint.updatedAt }),
      });
      if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error || "อัปเดตสถานะไม่สำเร็จ");
      await loadComplaints();
      await onChanged();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "อัปเดตสถานะไม่สำเร็จ");
    }
  };

  const saveComplaint = async () => {
    if (!editingComplaint) return;
    setIsSaving(true); setFormError("");
    try {
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/tickets/${editingComplaint.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...editForm, expectedUpdatedAt: editingComplaint.updatedAt }) });
      if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error || "แก้ไขเรื่องร้องเรียนไม่สำเร็จ");
      setEditingComplaint(null); await loadComplaints(); await onChanged(); notify({ message: "แก้ไขเรื่องร้องเรียนแล้ว" });
    } catch (error) { setFormError(error instanceof Error ? error.message : "แก้ไขเรื่องร้องเรียนไม่สำเร็จ"); }
    finally { setIsSaving(false); }
  };

  // ยกเลิกเรื่อง ไม่ได้ลบทิ้ง ประวัติกับข้อความเดิมยังอยู่ให้ตรวจย้อนหลังได้
  const cancelComplaint = async (complaint: Complaint) => {
    // ถามยืนยันก่อน เพราะย้อนกลับไม่ได้
    if (!await confirm({ title: "ยกเลิกเรื่องร้องเรียน?", description: `เรื่อง “${complaint.title}” จะถูกปิดเป็นยกเลิก ประวัติและข้อความเดิมยังคงอยู่เพื่อตรวจสอบ`, confirmLabel: "ยกเลิกเรื่อง", variant: "danger" })) return;
    setFormError("");
    try {
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/tickets/${complaint.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "CANCELLED", expectedUpdatedAt: complaint.updatedAt }) });
      if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error || "ยกเลิกเรื่องร้องเรียนไม่สำเร็จ");
      await loadComplaints(); await onChanged(); notify({ message: "ยกเลิกเรื่องร้องเรียนแล้ว" });
    } catch (error) { setFormError(error instanceof Error ? error.message : "ยกเลิกเรื่องร้องเรียนไม่สำเร็จ"); }
  };

  return (
    <section className="additional-page">
      {formError ? <p className="form-alert error" role="alert">{formError}</p> : null}
      {readOnly ? <ReadOnlyNotice>เปิดดูสถานะและอ่านข้อความตอบกลับได้ แต่ไม่สามารถเปลี่ยนสถานะหรือส่งคำตอบใหม่</ReadOnlyNotice> : null}
      <div className="figma-summary-grid four">
        <Summary label="เรื่องร้องเรียนทั้งหมด" value={`${complaints.length} รายการ`} icon={<MessageSquareWarning size={20} />} tone="indigo" />
        <Summary label="รายการใหม่" value={`${complaints.filter((item) => item.status === "รับเรื่องแล้ว").length} รายการ`} icon={<MessageSquareWarning size={20} />} tone="red" />
        <Summary label="กำลังตรวจสอบ" value={`${complaints.filter((item) => item.status === "กำลังตรวจสอบ").length} รายการ`} icon={<Clock3 size={20} />} tone="orange" />
        <Summary label="แก้ไขแล้ว" value={`${complaints.filter((item) => item.status === "แก้ไขแล้ว").length} รายการ`} icon={<CheckCircle2 size={20} />} tone="green" />
      </div>
      <nav aria-label="เลือกมุมมองเรื่องร้องเรียน" className="repair-section-tabs">
        <Link className="active" href={ownerPagePath(propertyId, "complaints")}>ร้องเรียน</Link>
        <Link href={ownerPagePath(propertyId, "repairHistory")}>ประวัติที่เสร็จแล้ว</Link>
      </nav>
      <article className="figma-table-card">
        <div className="figma-table-wrap">
          <table className="figma-table status-scan-table">
            <thead><tr><th scope="col">เลขที่</th><th scope="col">เรื่อง</th><th scope="col">ผู้แจ้ง/พื้นที่</th><th scope="col">วันที่แจ้ง</th><th scope="col">สถานะ</th><th scope="col">จัดการ</th></tr></thead>
            <tbody>{pageItems.map((item) => <tr data-status={item.hasUnreadReply ? "unread" : item.status} key={item.id}><td>{item.id}</td><td><strong>{item.title}</strong>{item.hasUnreadReply ? <small className="font-bold text-red-600">มีข้อความใหม่</small> : null}</td><td>{item.owner}<small>{item.room}</small></td><td>{item.date}</td><td><span className={`badge ${item.status === "แก้ไขแล้ว" ? "badge-paid" : "badge-pending"}`}>{item.status}</span></td><td><ActionMenu
              items={[
                { icon: <MessageSquare aria-hidden="true" size={16} />, id: "messages", label: replyTicketId === item.id ? "ปิดข้อความ" : "เปิดข้อความ", onSelect: () => setReplyTicketId((current) => current === item.id ? null : item.id) },
                ...(!readOnly && !["แก้ไขแล้ว", "ยกเลิกแล้ว"].includes(item.status) ? [{ icon: <Pencil aria-hidden="true" size={16} />, id: "edit", label: "แก้ไขเรื่องร้องเรียน", onSelect: () => { setEditingComplaint(item); setEditForm({ title: item.title, detail: item.detail ?? "", priority: item.priority ?? "NORMAL" }); } }] : []),
                ...(!readOnly && !["แก้ไขแล้ว", "ยกเลิกแล้ว"].includes(item.status) ? [{ icon: <ChevronRight aria-hidden="true" size={16} />, id: "advance", label: "อัปเดตเป็นสถานะถัดไป", onSelect: () => void advanceStatus(item) }] : []),
                ...(!readOnly && !["แก้ไขแล้ว", "ยกเลิกแล้ว"].includes(item.status) ? [{ icon: <Ban aria-hidden="true" size={16} />, id: "cancel", label: "ยกเลิกเรื่องร้องเรียน", variant: "danger" as const, onSelect: () => void cancelComplaint(item) }] : []),
              ]}
              label={`จัดการเรื่องร้องเรียน ${item.id}`}
            /></td></tr>)}</tbody>
          </table>
        </div>
        {replyTicketId ? <div className="p-4"><TicketReplyThread
          endpoint={`/api/v1/admin/properties/${propertyId}/tickets/${replyTicketId}/replies`}
          onRead={() => { void loadComplaints(); void onUnreadChanged(); }}
          readOnly={readOnly}
          viewerRole="PROPERTY_ADMIN"
        /></div> : null}
        <TablePagination page={page} setPage={setPage} totalItems={complaints.length} totalPages={totalPages} />
        {hasNextPage ? <button className="secondary-button" disabled={isLoadingMore} onClick={() => void loadComplaints(serverPage + 1, true)} type="button">
          {isLoadingMore ? "กำลังโหลด..." : "โหลดเรื่องร้องเรียนเพิ่มเติม"}
        </button> : null}
      </article>
      {editingComplaint && !readOnly ? <Dialog ariaDescribedBy="complaint-edit-description" ariaLabelledBy="complaint-edit-title" className="modal-md" onClose={() => setEditingComplaint(null)}>
        <header className="modal-header"><div><h2 id="complaint-edit-title">แก้ไขเรื่องร้องเรียน</h2><p id="complaint-edit-description">ประวัติสถานะและข้อความตอบกลับจะไม่ถูกลบ</p></div><Button aria-label="ปิด" onClick={() => setEditingComplaint(null)} variant="icon">×</Button></header>
        <div className="modal-form"><label><span>หัวข้อ</span><input maxLength={200} onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))} required value={editForm.title} /></label><label><span>รายละเอียด</span><textarea maxLength={4000} onChange={(event) => setEditForm((current) => ({ ...current, detail: event.target.value }))} required rows={5} value={editForm.detail} /></label><DropdownField label="ความเร่งด่วน" onChange={(value) => setEditForm((current) => ({ ...current, priority: value as "NORMAL" | "URGENT" }))} options={[{ value: "NORMAL", label: "ปกติ" }, { value: "URGENT", label: "ด่วน" }]} value={editForm.priority} /></div>
        <footer className="modal-actions"><Button onClick={() => setEditingComplaint(null)} variant="secondary">ยกเลิก</Button><Button disabled={!editForm.title.trim() || !editForm.detail.trim()} isLoading={isSaving} onClick={() => void saveComplaint()}>บันทึกการแก้ไข</Button></footer>
      </Dialog> : null}
      {confirmationDialog}
    </section>
  );
}

// เนื้อหาคู่มือทั้งหมดเก็บเป็นข้อมูลไว้ในไฟล์นี้ ไม่ได้ดึงจากเซิร์ฟเวอร์
// แก้คู่มือแล้วต้อง deploy ใหม่ แลกกับการที่หน้านี้เปิดได้ทันทีและใช้ได้แม้ตอนเน็ตมีปัญหา
const helpTopics = [
  {
    id: "getting-started",
    title: "เริ่มต้นใช้งานระบบ",
    summary: "เข้าสู่ระบบ เลือกหอพัก และทำความเข้าใจหน้าหลัก",
    articles: [
      { title: `เริ่มต้นใช้งาน ${platformProfile.name}`, body: ["เข้าสู่ระบบด้วยบัญชีที่แอดมินใหญ่มอบหมาย จากนั้นเลือกหอพักที่ต้องการจัดการจากมุมซ้ายบน", "หน้าแดชบอร์ดจะแสดงรายได้ ห้องว่าง ห้องที่มีผู้เช่า ยอดค้างชำระ และรายการสำคัญของรอบบิลปัจจุบัน"] },
      { title: "การเลือกและสลับหอพัก", body: ["กดชื่อหอพักด้านบนของเมนูซ้ายเพื่อดูหอพักที่บัญชีของคุณมีสิทธิ์จัดการ", "ข้อมูลผู้เช่า ห้อง บิล และข้อความจะถูกแยกตามหอพักโดยอัตโนมัติ"] },
    ],
  },
  {
    id: "rooms-tenants",
    title: "ห้องพักและผู้เช่า",
    summary: "เพิ่มชั้น ห้อง เฟอร์นิเจอร์ และจัดการข้อมูลผู้เช่า",
    articles: [
      { title: "เพิ่มชั้นและห้องพัก", body: ["ไปที่ ตั้งค่า → ห้องพัก แล้วเพิ่มชั้นก่อนสร้างห้องใหม่", "กำหนดเลขห้อง ประเภท ค่าเช่า และเฟอร์นิเจอร์เริ่มต้นให้ครบก่อนเปิดรับผู้เช่า"] },
      { title: "เพิ่มและแก้ไขผู้เช่า", body: ["ไปที่หน้าผู้เช่าแล้วกดเพิ่มผู้เช่า เลือกห้องว่างและกรอกข้อมูลสัญญา", "กดแถวผู้เช่าเพื่อดูรายละเอียดหรือแก้ไขข้อมูลภายหลัง"] },
    ],
  },
  {
    id: "meters-billing",
    title: "มิเตอร์ บิล และการเงิน",
    summary: "จดมิเตอร์ ตั้งค่าใช้จ่าย ออกบิล และติดตามการชำระ",
    articles: [
      { title: "บันทึกเลขมิเตอร์ประจำเดือน", body: ["เลือกค่าน้ำหรือค่าไฟจากเมนูซ้าย กรองชั้น แล้วกรอกเลขมิเตอร์ล่าสุดของแต่ละห้อง", "ระบบคำนวณหน่วยที่ใช้และยอดเงินตามอัตราที่กำหนดไว้ในหน้าตั้งค่า"] },
      { title: "ตรวจสอบและติดตามบิล", body: ["หน้าบิลและการเงินแสดงบิลที่ชำระแล้ว รอชำระ และค้างชำระ", "ใช้ตัวกรองสถานะเพื่อค้นหารายการ และเปิดแท็บตรวจสอบการชำระเพื่ออนุมัติหลักฐานการโอน"] },
    ],
  },
  {
    id: "complaints",
    title: "เรื่องร้องเรียนและประวัติงาน",
    summary: "รับเรื่อง ติดตามสถานะ และดูประวัติที่ดำเนินการแล้ว",
    articles: [
      { title: "เพิ่มและติดตามเรื่องร้องเรียน", body: ["กดแจ้งเรื่องใหม่ กรอกหัวข้อ ผู้แจ้ง และห้องหรือพื้นที่ที่เกี่ยวข้อง", "รายการใหม่จะปรากฏในตารางเพื่อให้ผู้ดูแลติดตามและอัปเดตสถานะ"] },
      { title: "ดูประวัติงานที่เสร็จแล้ว", body: ["เลือกแท็บประวัติที่เสร็จแล้ว และกรองตามชั้นหรือเลขห้องเพื่อค้นหางานย้อนหลัง"] },
    ],
  },
  {
    id: "communication",
    title: "พัสดุ ประกาศ และแชท",
    summary: "ลงทะเบียนพัสดุ ส่งประกาศ และสนทนากับผู้เช่า",
    articles: [
      { title: "รับพัสดุเข้าหอพัก", body: ["กดรับพัสดุใหม่ เลือกชั้นและห้อง เพิ่มหมายเหตุหรือรูปถ่าย แล้วบันทึก", "เมื่อส่งมอบให้ผู้เช่าแล้วให้กดรับแล้ว รายการจะย้ายไปยังประวัติ"] },
      { title: "ประกาศและข้อความแบบเรียลไทม์", body: ["สร้างประกาศเพื่อส่งถึงทุกห้อง อาคาร หรือชั้นที่เลือก และตั้งเวลาเผยแพร่ได้", "ใช้ปุ่มแชทด้านล่างเพื่อส่งข้อความ รูปภาพ หรือไฟล์ถึงผู้เช่าแบบเรียลไทม์"] },
    ],
  },
];

// ศูนย์ช่วยเหลือ ค้นหาและอ่านคู่มือการใช้งาน
// รวมทุกคำในหัวข้อช่วยเหลือเป็นสตริงเดียวสำหรับค้นหา
function topicSearchText(topic: (typeof helpTopics)[number]) {
  const articleText = topic.articles.map((article) => `${article.title} ${article.body.join(" ")}`).join(" ");
  return `${topic.title} ${topic.summary} ${articleText}`;
}

export function HelpPage() {
  const [query, setQuery] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedArticleIndex, setSelectedArticleIndex] = useState(0);
  const selectedTopic = helpTopics.find((topic) => topic.id === selectedTopicId);
  const normalizedQuery = query.trim().toLocaleLowerCase("th-TH");
  // ค้นทั้งหัวข้อ คำโปรย และเนื้อหาข้างในทุกบทความ ต่อเป็นสตริงเดียวแล้วค่อยหา
  const filteredTopics = helpTopics.filter((topic) =>
    topicSearchText(topic).toLocaleLowerCase("th-TH").includes(normalizedQuery),
  );

  // เปิดบทความแล้วเลื่อนหน้าไปหา เพราะบนมือถือเนื้อหาอยู่ใต้รายการหัวข้อ
  const openTopic = (topicId: string, articleIndex = 0) => {
    setSelectedTopicId(topicId);
    setSelectedArticleIndex(articleIndex);
    // รอให้บทความถูกวาดก่อนค่อยเลื่อนไปหา ไม่งั้นยังไม่มีองค์ประกอบให้เลื่อนไป
    window.requestAnimationFrame(() => document.getElementById("help-article")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <section className="help-page">
      <article className="help-center-hero">
        <span><CircleHelp size={36} /></span>
        <p>ศูนย์ช่วยเหลือ {platformProfile.name}</p>
        <h2>ต้องการให้เราช่วยเรื่องอะไร?</h2>
        <label><Search size={21} /><input aria-label="ค้นหาคู่มือ" onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาห้อง ผู้เช่า มิเตอร์ บิล หรือการตั้งค่า..." value={query} /></label>
        <small>ค้นหาคำตอบและขั้นตอนการใช้งานทุกส่วนของระบบบริหารหอพัก</small>
      </article>

      <section className="help-catalog">
        <div className="help-section-heading"><p>คู่มือการใช้งานระบบ</p><h2>เลือกหัวข้อที่ต้องการ</h2></div>
        <div className="help-topic-grid">
          {filteredTopics.map((topic, index) => (
            <button key={topic.id} onClick={() => openTopic(topic.id)} type="button">
              <span>{index + 1}</span>
              <div><strong>{topic.title}</strong><small>{topic.summary}</small><em>{topic.articles.length} บทความ</em></div>
              <ChevronRight size={20} />
            </button>
          ))}
        </div>
        {filteredTopics.length === 0 ? <SearchEmptyState description="ลองใช้คำค้นอื่น เช่น บิล ห้องพัก หรือผู้เช่า" title="ไม่พบหัวข้อที่ค้นหา" /> : null}
      </section>

      {selectedTopic ? (
        <section className="help-article-layout" id="help-article">
          <aside>
            <small>บทความในหมวดนี้</small>
            <h3>{selectedTopic.title}</h3>
            {selectedTopic.articles.map((article, index) => (
              <button className={selectedArticleIndex === index ? "active" : ""} key={article.title} onClick={() => setSelectedArticleIndex(index)} type="button">{article.title}</button>
            ))}
          </aside>
          <article>
            <p>ศูนย์ช่วยเหลือ / {selectedTopic.title}</p>
            <h2>{selectedTopic.articles[selectedArticleIndex].title}</h2>
            <div className="help-article-body">
              {selectedTopic.articles[selectedArticleIndex].body.map((paragraph, index) => (
                <section key={paragraph}>
                  <span>{index + 1}</span>
                  <div><h3>ขั้นตอนที่ {index + 1}</h3><p>{paragraph}</p></div>
                </section>
              ))}
            </div>
            <div className="help-article-note"><CircleHelp size={20} /><p><strong>ยังต้องการความช่วยเหลือ?</strong><span>กดปุ่มแชทด้านล่างเพื่อสอบถามผู้ดูแลระบบได้ทันที</span></p></div>
          </article>
        </section>
      ) : null}
    </section>
  );
}

// รายการหอพักที่บัญชีนี้ดูแลอยู่ กดเพื่อสลับไปทำงานในหออื่น
export function PropertiesPage({
  activePropertyId,
  properties,
}: Readonly<{
  activePropertyId: string;
  properties: Array<{ id: string; name: string; shortName: string; rooms?: number }>;
}>) {
  return (
    <section className="additional-page">
      <div className="property-page-head"><div><h2>หอพักทั้งหมด</h2><p>เลือกหอพักที่ต้องการบริหารจัดการ</p></div></div>
      <div className="property-page-grid">{properties.map((property) => <article key={property.id}><span><Building2 size={24} /></span><div><small>{property.id === activePropertyId ? "กำลังใช้งาน" : "พร้อมใช้งาน"}</small><h3>{property.shortName}</h3><p>{property.rooms === undefined ? "กำลังโหลดจำนวนห้อง" : `${property.rooms} ห้องพัก`}</p></div><button className="secondary-button" onClick={() => {
                        // สลับหอพักต้องโหลดใหม่ทั้งหน้าโดยตั้งใจ เพื่อทิ้ง state และแคชของหอเดิม
                        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                        window.location.assign(`/admin/properties/${property.id}`);
                      }} type="button">จัดการหอพัก</button></article>)}</div>
    </section>
  );
}

// การ์ดตัวเลขสรุปที่ใช้ร่วมกันในไฟล์นี้ จึงไม่ต้อง export
function Summary({ icon, label, tone, value }: Readonly<{ icon: ReactNode; label: string; tone: string; value: string }>) {
  return <article className={`figma-summary-card tone-${tone}`}><div><small>{label}</small><strong>{value}</strong></div><span>{icon}</span></article>;
}
