"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Additional Pages” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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
import { ownerPagePath } from "@/lib/navigation-routes";
import { platformProfile } from "@/lib/platform-profile";
import type { Room } from "@/types/dorm";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Announcement Audience” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type AnnouncementAudience = "ALL_TENANTS" | "BUILDING" | "FLOOR" | "ROOM";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Announcement” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
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
  updatedAt?: string;
  publishAt?: string | null;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แปลงข้อมูลในขั้นตอน “today Input Value” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function todayInputValue() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Announcements Page” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { initialAnnouncements, onChanged, propertyId, readOnly = fa: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function AnnouncementsPage({ initialAnnouncements, onChanged, propertyId, readOnly = false, recipientRoomCount, rooms }: {
  initialAnnouncements: Announcement[];
  onChanged: () => Promise<void>;
  propertyId: string;
  readOnly?: boolean;
  recipientRoomCount: number;
  rooms: Room[];
}) {
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

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “load Announcements” แล้วส่งผลที่เหมาะสมกลับไป
   * รับค่า:
   * - targetPage: ค่า “target Page” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - append: ค่า “append” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
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
      /**
       * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
       * หน้าที่: แปลงข้อมูลในขั้นตอน “mapped” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
       * รับค่า:
       * - item: ค่า “item” ที่จำเป็นต่อการทำงานของก้อนนี้
       * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
       */
      const mapped: Announcement[] = payload.data.map((item) => ({
        id: item.id,
        title: item.title,
        content: item.content,
        audience: item.audience === "ALL_TENANTS" ? "ผู้เช่าทุกห้อง" : item.audience === "BUILDING" ? `อาคาร ${item.building?.name ?? "-"}` : item.audience === "FLOOR" ? `${item.floor?.label ?? `ชั้น ${item.floor?.number ?? "-"}`}` : `${item.rooms.length} ห้อง`,
        audienceType: item.audience as AnnouncementAudience,
        buildingId: item.building?.id,
        floorId: item.floor?.id,
        roomIds: item.rooms.map(({ room }) => rooms.find((candidate) => candidate.id === room.number)?.databaseId).filter((id): id is string => Boolean(id)),
        date: new Date(item.publishAt ?? item.publishedAt ?? item.createdAt).toLocaleString("th-TH"),
        status: item.status === "SCHEDULED" ? "ตั้งเวลา" : item.status === "DRAFT" ? "ฉบับร่าง" : "เผยแพร่แล้ว",
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

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “reset Form” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const resetForm = () => {
    setForm({ audience: "ALL_TENANTS", buildingId: "", floorId: "", roomIds: [], content: "", publishDate: todayInputValue(), publishMode: "now", title: "" });
    setFormError("");
    setEditingId(null);
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “open Create Form” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const openCreateForm = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “open Edit Form” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - announcement: ค่า “announcement” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const openEditForm = (announcement: Announcement) => {
    setEditingId(announcement.id);
    setForm({
      audience: announcement.audienceType ?? "ALL_TENANTS",
      buildingId: announcement.buildingId ?? "",
      floorId: announcement.floorId ?? "",
      roomIds: announcement.roomIds ?? [],
      content: announcement.content,
      publishDate: announcement.publishAt?.slice(0, 10) ?? todayInputValue(),
      publishMode: announcement.status === "ตั้งเวลา" ? "scheduled" : "now",
      title: announcement.title,
    });
    setFormError("");
    setIsCreateOpen(true);
  };

  useEffect(() => { void loadAnnouncements(); }, [loadAnnouncements]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “save Announcement” โดยใช้ค่าที่รับเข้ามา
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
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
    if ((form.audience === "BUILDING" && !form.buildingId) || (form.audience === "FLOOR" && !form.floorId) || (form.audience === "ROOM" && form.roomIds.length === 0)) {
      setFormError("กรุณาเลือกกลุ่มผู้รับประกาศให้ครบ");
      return;
    }

    setIsSaving(true);
    try {
      const current = editingId ? announcements.find((item) => item.id === editingId) : undefined;
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/announcements${editingId ? `/${editingId}` : ""}`, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, content, audience: form.audience,
          buildingId: form.audience === "BUILDING" ? form.buildingId : undefined,
          floorId: form.audience === "FLOOR" ? form.floorId : undefined,
          roomIds: form.audience === "ROOM" ? form.roomIds : [],
          status: form.publishMode === "now" ? "PUBLISHED" : "SCHEDULED",
          ...(form.publishMode === "scheduled" ? { publishAt: new Date(`${form.publishDate}T09:00:00+07:00`).toISOString() } : {}),
          ...(editingId ? { expectedUpdatedAt: current?.updatedAt } : {}),
        }),
      });
      if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error || "บันทึกประกาศไม่สำเร็จ");
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

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “delete Announcement” ตามกฎของระบบ
   * รับค่า:
   * - announcement: ค่า “announcement” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const deleteAnnouncement = (announcement: Announcement) => {
    setAnnouncementToDelete(announcement);
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
        <div className="additional-card-head">
          <div><h2>ประกาศและข่าวสาร</h2><p>สื่อสารข่าวสารสำคัญถึงผู้เช่าในหอพัก</p></div>
          {!readOnly ? (
            <button className="primary-button" onClick={openCreateForm} type="button">
              <Plus aria-hidden="true" size={18} /> สร้างประกาศ
            </button>
          ) : null}
        </div>
        <div className="figma-table-wrap">
          <table className="figma-table">
            <thead><tr><th>หัวข้อ</th><th>กลุ่มผู้รับ</th><th>วันที่เผยแพร่</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
            <tbody>{pageItems.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.title}</strong></td>
                <td>{item.audience}</td><td>{item.date}</td>
                <td><span className={`badge ${item.status === "เผยแพร่แล้ว" ? "badge-paid" : "badge-pending"}`}>{item.status}</span></td>
                <td>
                  {!readOnly ? <ActionMenu
                    items={[
                      { id: "edit", label: "แก้ไข", onSelect: () => openEditForm(item) },
                      { id: "delete", label: "ลบ", onSelect: () => deleteAnnouncement(item), variant: "danger" },
                    ]}
                    label={`จัดการประกาศ ${item.title}`}
                  /> : null}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <TablePagination page={page} setPage={setPage} totalItems={announcements.length} totalPages={totalPages} />
        {hasNextPage ? <LoadMoreButton isLoading={isLoadingMore} label="โหลดประกาศเพิ่มเติม" onClick={() => void loadAnnouncements(serverPage + 1, true)} /> : null}
      </article>
      {isCreateOpen ? (
        <Dialog ariaDescribedBy="create-announcement-description" ariaLabelledBy="create-announcement-title" onClose={() => { resetForm(); setIsCreateOpen(false); }}>
          <form className="modal-form"
            onSubmit={(event) => {
              event.preventDefault();
              void saveAnnouncement();
            }}
          >
            <header className="modal-header">
              <div><h2 id="create-announcement-title">{editingId ? "แก้ไขประกาศ" : "สร้างประกาศใหม่"}</h2><p id="create-announcement-description">กำหนดเนื้อหา กลุ่มผู้รับ และเวลาที่ต้องการเผยแพร่</p></div>
              <IconButton label="ปิด" onClick={() => {
                resetForm();
                setIsCreateOpen(false);
              }} tooltip="ปิดหน้าต่างประกาศ">×</IconButton>
            </header>

            <label>
              <span>หัวข้อประกาศ</span>
              <input
                maxLength={120}
                onChange={(event) => {
                  setForm((current) => ({ ...current, title: event.target.value }));
                  setFormError("");
                }}
                placeholder="เช่น แจ้งปิดน้ำชั่วคราว"
                required
                value={form.title}
              />
            </label>

            <label>
              <span>เนื้อหาประกาศ</span>
              <textarea
                maxLength={2000}
                onChange={(event) => {
                  setForm((current) => ({ ...current, content: event.target.value }));
                  setFormError("");
                }}
                placeholder="รายละเอียดที่ต้องการแจ้งผู้เช่า"
                required
                rows={6}
                value={form.content}
              />
            </label>

            <DropdownField
              label="กลุ่มผู้รับ"
              onChange={(audience) => setForm((current) => ({ ...current, audience: audience as AnnouncementAudience, buildingId: "", floorId: "", roomIds: [] }))}
              options={[{ label: "ผู้เช่าทุกห้อง", value: "ALL_TENANTS" }, { label: "เฉพาะอาคาร", value: "BUILDING" }, { label: "เฉพาะชั้น", value: "FLOOR" }, { label: "เลือกห้อง", value: "ROOM" }]}
              value={form.audience}
            />

            {form.audience === "BUILDING" ? <DropdownField label="อาคาร" onChange={(buildingId) => setForm((current) => ({ ...current, buildingId }))} options={Array.from(new Map(rooms.flatMap((room) => room.buildingId ? [[room.buildingId, { label: room.buildingName ?? room.buildingId, value: room.buildingId }] as const] : [])).values())} value={form.buildingId} /> : null}
            {form.audience === "FLOOR" ? <DropdownField label="ชั้น" onChange={(floorId) => setForm((current) => ({ ...current, floorId }))} options={Array.from(new Map(rooms.flatMap((room) => room.floorId ? [[room.floorId, { label: `${room.buildingName ?? "อาคาร"} · ชั้น ${room.floor}`, value: room.floorId }] as const] : [])).values())} value={form.floorId} /> : null}
            {form.audience === "ROOM" ? <fieldset><legend>ห้องที่ได้รับประกาศ</legend><div className="max-h-48 overflow-y-auto rounded-xl border border-[#d7d8df] p-3">{rooms.filter((room) => room.databaseId && room.status === "occupied").map((room) => <label className="flex items-center gap-2 py-1" key={room.databaseId}><input checked={form.roomIds.includes(room.databaseId!)} onChange={(event) => setForm((current) => ({ ...current, roomIds: event.target.checked ? [...current.roomIds, room.databaseId!] : current.roomIds.filter((id) => id !== room.databaseId) }))} type="checkbox" />ห้อง {room.id} · {room.buildingName ?? "-"} ชั้น {room.floor}</label>)}</div></fieldset> : null}
            <p className="text-sm text-[#73757d]">ผู้รับประมาณ {form.audience === "ALL_TENANTS" ? recipientRoomCount : form.audience === "BUILDING" ? rooms.filter((room) => room.status === "occupied" && room.buildingId === form.buildingId).length : form.audience === "FLOOR" ? rooms.filter((room) => room.status === "occupied" && room.floorId === form.floorId).length : form.roomIds.length} ห้อง</p>

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

            {form.publishMode === "scheduled" ? (
              <label>
                <span>วันที่เผยแพร่</span>
                <input min={todayInputValue()} onChange={(event) => setForm((current) => ({ ...current, publishDate: event.target.value }))} required type="date" value={form.publishDate} />
              </label>
            ) : null}

            {formError ? <p role="alert">{formError}</p> : null}

            <footer className="modal-actions">
              <button onClick={() => {
                resetForm();
                setIsCreateOpen(false);
              }} type="button">ยกเลิก</button>
              <button disabled={isSaving} type="submit">{isSaving ? "กำลังบันทึก..." : editingId ? "บันทึกการแก้ไข" : "สร้างประกาศ"}</button>
            </footer>
          </form>
        </Dialog>
      ) : null}
      {announcementToDelete ? (
        <ConfirmationDialog
          confirmLabel="ลบประกาศ"
          description={`ประกาศ “${announcementToDelete.title}” จะถูกลบออกจากรายการ`}
          onCancel={() => setAnnouncementToDelete(null)}
          onConfirm={() => {
            const target = announcementToDelete;
            void fetch(`/api/v1/admin/properties/${propertyId}/announcements/${target.id}`, {
              method: "PATCH", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "ARCHIVED", expectedUpdatedAt: target.updatedAt }),
            }).then(async (response) => {
              if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error || "เก็บประกาศไม่สำเร็จ");
              setAnnouncementToDelete(null);
              await loadAnnouncements();
              await onChanged();
            }).catch((error: unknown) => setFormError(error instanceof Error ? error.message : "เก็บประกาศไม่สำเร็จ"));
          }}
          title="ลบประกาศนี้หรือไม่?"
          variant="danger"
        />
      ) : null}
    </section>
  );
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Complaint” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Complaints Page” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { complaints: initialComplaints, onChanged, onAddRequestHand: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function ComplaintsPage({
  complaints: initialComplaints,
  onChanged,
  onAddRequestHandled,
  openAddOnMount,
  onUnreadChanged,
  propertyId,
  readOnly = false,
}: {
  complaints: Complaint[];
  onChanged: () => Promise<void>;
  onAddRequestHandled: () => void;
  openAddOnMount: boolean;
  onUnreadChanged: () => Promise<void>;
  propertyId: string;
  readOnly?: boolean;
}) {
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

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “load Complaints” แล้วส่งผลที่เหมาะสมกลับไป
   * รับค่า:
   * - targetPage: ค่า “target Page” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - append: ค่า “append” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
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
      /**
       * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
       * หน้าที่: แปลงข้อมูลในขั้นตอน “mapped” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
       * รับค่า:
       * - item: ค่า “item” ที่จำเป็นต่อการทำงานของก้อนนี้
       * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
       */
      const mapped: Complaint[] = payload.data.map((item) => ({
        id: item.id,
        title: item.title,
        room: item.room?.number ?? "-",
        owner: item.tenantProfile?.user.displayName ?? "ไม่ระบุชื่อ",
        date: new Date(item.createdAt).toLocaleString("th-TH"),
        hasUnreadReply: item.hasUnreadReply,
        status: item.status === "RESOLVED" ? "แก้ไขแล้ว" : item.status === "CANCELLED" ? "ยกเลิกแล้ว" : item.status === "ACKNOWLEDGED" || item.status === "IN_PROGRESS" ? "กำลังตรวจสอบ" : "รับเรื่องแล้ว",
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

  useEffect(() => {
    void loadComplaints();
    if (openAddOnMount) onAddRequestHandled();
  }, [loadComplaints, onAddRequestHandled, openAddOnMount]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “advance Status” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - complaint: ค่า “complaint” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const advanceStatus = async (complaint: Complaint) => {
    const status = complaint.status === "รับเรื่องแล้ว" ? "ACKNOWLEDGED"
      : complaint.status === "กำลังตรวจสอบ" ? "RESOLVED" : null;
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

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “save Complaint” โดยใช้ค่าที่รับเข้ามา
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
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

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “cancel Complaint” ตามกฎของระบบ
   * รับค่า:
   * - complaint: ค่า “complaint” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const cancelComplaint = async (complaint: Complaint) => {
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
        <div className="additional-card-head"><div><h2>รายการร้องเรียน</h2><p>{readOnly ? "ตรวจสอบสถานะและประวัติเรื่องร้องเรียนจากผู้เช่า" : "ติดตามและจัดการเรื่องร้องเรียนจากผู้เช่า"}</p></div></div>
        <div className="figma-table-wrap">
          <table className="figma-table status-scan-table">
            <thead><tr><th>เลขที่</th><th>เรื่อง</th><th>ผู้แจ้ง/พื้นที่</th><th>วันที่แจ้ง</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
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
      {editingComplaint && !readOnly ? <Dialog ariaDescribedBy="complaint-edit-description" ariaLabelledBy="complaint-edit-title" onClose={() => setEditingComplaint(null)}>
        <header className="modal-header"><div><h2 id="complaint-edit-title">แก้ไขเรื่องร้องเรียน</h2><p id="complaint-edit-description">ประวัติสถานะและข้อความตอบกลับจะไม่ถูกลบ</p></div><Button aria-label="ปิด" onClick={() => setEditingComplaint(null)} variant="icon">×</Button></header>
        <div className="modal-form"><label><span>หัวข้อ</span><input maxLength={200} onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))} required value={editForm.title} /></label><label><span>รายละเอียด</span><textarea maxLength={4000} onChange={(event) => setEditForm((current) => ({ ...current, detail: event.target.value }))} required rows={5} value={editForm.detail} /></label><DropdownField label="ความเร่งด่วน" onChange={(value) => setEditForm((current) => ({ ...current, priority: value as "NORMAL" | "URGENT" }))} options={[{ value: "NORMAL", label: "ปกติ" }, { value: "URGENT", label: "ด่วน" }]} value={editForm.priority} /></div>
        <footer className="modal-actions"><Button onClick={() => setEditingComplaint(null)} variant="secondary">ยกเลิก</Button><Button disabled={!editForm.title.trim() || !editForm.detail.trim()} isLoading={isSaving} onClick={() => void saveComplaint()}>บันทึกการแก้ไข</Button></footer>
      </Dialog> : null}
      {confirmationDialog}
    </section>
  );
}

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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Help Page” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function HelpPage() {
  const [query, setQuery] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedArticleIndex, setSelectedArticleIndex] = useState(0);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “selected Topic” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - topic: ค่า “topic” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const selectedTopic = helpTopics.find((topic) => topic.id === selectedTopicId);
  const normalizedQuery = query.trim().toLocaleLowerCase("th-TH");
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “filtered Topics” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - topic: ค่า “topic” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const filteredTopics = helpTopics.filter((topic) =>
    `${topic.title} ${topic.summary} ${topic.articles.map((article) => `${article.title} ${article.body.join(" ")}`).join(" ")}`
      .toLocaleLowerCase("th-TH")
      .includes(normalizedQuery),
  );

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “open Topic” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - topicId: รหัสภายในของ topic
   * - articleIndex: ค่า “article Index” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const openTopic = (topicId: string, articleIndex = 0) => {
    setSelectedTopicId(topicId);
    setSelectedArticleIndex(articleIndex);
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Properties Page” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { activePropertyId, properties, }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function PropertiesPage({
  activePropertyId,
  properties,
}: {
  activePropertyId: string;
  properties: Array<{ id: string; name: string; shortName: string; rooms?: number }>;
}) {
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Summary” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { icon, label, tone, value }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function Summary({ icon, label, tone, value }: { icon: ReactNode; label: string; tone: string; value: string }) {
  return <article className={`figma-summary-card tone-${tone}`}><div><small>{label}</small><strong>{value}</strong></div><span>{icon}</span></article>;
}
