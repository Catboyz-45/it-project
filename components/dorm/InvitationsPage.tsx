"use client";
// โหลดข้อมูล ส่งคำขอ และคัดลอกรหัสจากเบราว์เซอร์

import { SyntheticEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Clipboard,
  Link2,
  RefreshCw,
  Send,
  XCircle,
} from "lucide-react";
import { ReadOnlyNotice } from "@/components/dorm/ReadOnlyNotice";
import { useConfirmation } from "@/components/ui/use-confirmation";
import { LoadMoreButton } from "@/components/ui/DataNavigation";
import { DropdownField } from "@/components/dorm/DropdownField";
import { formatClientError, readApiData, readApiPayload } from "@/lib/client/api-error";

// ห้องที่เลือกได้ตอนสร้างคำเชิญ
type RoomOption = {
  id: string;
  number: string;
  status: string;
  capacity: number;
  building: { name: string; code: string };
  floor: { number: number; label: string | null };
};

// คำเชิญหนึ่งใบ ตัวรหัสจริงไม่ได้อยู่ในนี้ เพราะฐานข้อมูลเก็บแค่ค่า hash
type Invitation = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
  // กำหนดไว้ตั้งแต่ตอนสร้าง ผู้รับคำเชิญเปลี่ยนสิทธิ์ของตัวเองไม่ได้
  intendedRole: "PRIMARY" | "CO_OCCUPANT";
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  room: { id: string; number: string };
  acceptedBy: { user: { displayName: string; email: string } } | null;
};

type PageInfo = {
  page: number;
  pageSize: number;
  hasNextPage: boolean;
};

// รหัสจริงมากับตอบกลับครั้งนี้ครั้งเดียว ไม่มีทางขอดูย้อนหลังได้อีก
type CreatedInvitation = {
  invitation: Invitation;
  invitationCode: string;
};

// ห่อ readApiData ไว้ให้ข้อความผิดพลาดของทั้งไฟล์นี้เหมือนกันหมด
async function readData<T>(response: Response): Promise<T> {
  return readApiData<T>(response, "ดำเนินการไม่สำเร็จ");
}

// หน้าสร้างและติดตามคำเชิญผู้เช่า ผู้เช่าเอารหัสไปใช้ตอนสมัครเพื่อผูกกับห้อง
// initialData ส่งมาจาก Server Component ของหน้านี้ ห้องกับคำเชิญจึงมาพร้อม HTML
// ไม่ต้องยิงสองคำขอหลัง hydrate เสร็จ
export function InvitationsPage({ initialData = null, propertyId, readOnly = false }: Readonly<{
  initialData?: { invitations: Invitation[]; pageInfo: PageInfo; rooms: RoomOption[] } | null;
  propertyId: string;
  readOnly?: boolean;
}>) {
  const [rooms, setRooms] = useState<RoomOption[]>(initialData?.rooms ?? []);
  const [invitations, setInvitations] = useState<Invitation[]>(initialData?.invitations ?? []);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(initialData?.pageInfo ?? null);
  const skipInitialLoadRef = useRef(initialData !== null);
  const [roomId, setRoomId] = useState("");
  const [intendedRole, setIntendedRole] = useState<"PRIMARY" | "CO_OCCUPANT">("PRIMARY");
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [createdCode, setCreatedCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { confirm, confirmationDialog } = useConfirmation();
  const [message, setMessage] = useState("");

  // โหลดทั้งรายการห้องและประวัติคำเชิญ
  const load = useCallback(async (targetPage = 1, append = false) => {
    setLoading(true);
    setError("");
    try {
      const { availableRooms, invitationPage } = await requestInvitationData(propertyId, targetPage);
      setRooms(availableRooms);
      // คงห้องที่เลือกไว้ถ้ายังมีอยู่ ไม่งั้นเด้งไปห้องแรก กันช่องเลือกว่างเปล่า
      setRoomId((current) => availableRooms.some((room) => room.id === current) ? current : availableRooms[0]?.id ?? "");
      setInvitations((current) => append ? [...current, ...invitationPage.data] : invitationPage.data);
      setPageInfo(invitationPage.pageInfo);
    } catch (cause) {
      setError(formatClientError(cause, "โหลดข้อมูลไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    // เซิร์ฟเวอร์ส่งมาให้แล้ว รอบแรกจึงข้ามไป
    if (skipInitialLoadRef.current) {
      skipInitialLoadRef.current = false;
      return;
    }
    void load();
  }, [load]);

  async function createInvitation(event: SyntheticEvent<HTMLFormElement>) {
    // กันเบราว์เซอร์รีเฟรชหน้าตามพฤติกรรมฟอร์มปกติ ถ้ารีเฟรชรหัสที่เพิ่งได้จะหายไปเลย
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    // ล้างรหัสเก่าทิ้งก่อน กันเข้าใจผิดว่ารหัสที่ค้างอยู่คือของใบใหม่
    setCreatedCode("");
    setCopied(false);
    try {
      const result = await readData<CreatedInvitation>(await fetch(
        `/api/v1/admin/properties/${propertyId}/invitations`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId, intendedRole, expiresInDays }),
        },
      ));
      setCreatedCode(result.invitationCode);
      setMessage("สร้างคำเชิญแล้ว กรุณาคัดลอกรหัสและส่งให้ผู้เช่า");
      await load();
    } catch (cause) {
      setError(formatClientError(cause, "สร้างคำเชิญไม่สำเร็จ"));
    } finally {
      setSubmitting(false);
    }
  }

  async function copyCode() {
    try {
      // คลิปบอร์ดใช้ไม่ได้ถ้าไม่ได้อยู่บน HTTPS หรือผู้ใช้ไม่อนุญาต จึงต้องมีทางสำรองให้เลือกเอง
      await navigator.clipboard.writeText(createdCode);
      setCopied(true);
      setMessage("คัดลอกรหัสคำเชิญแล้ว");
    } catch {
      setError("คัดลอกอัตโนมัติไม่สำเร็จ กรุณาเลือกรหัสแล้วคัดลอกด้วยตนเอง");
    }
  }

  // ยกเลิกคำเชิญที่ยังไม่มีใครใช้ ทำแล้วรหัสเดิมใช้ไม่ได้อีก
  async function revoke(invitationId: string) {
    // ถามยืนยันก่อน เพราะย้อนกลับไม่ได้ ต้องสร้างใบใหม่แล้วส่งรหัสใหม่ให้ผู้เช่า
    if (!await confirm({ title: "ยกเลิกคำเชิญ?", description: "ผู้เช่าจะไม่สามารถใช้รหัสนี้ได้อีก การดำเนินการนี้ย้อนกลับไม่ได้", confirmLabel: "ยกเลิกคำเชิญ", variant: "danger" })) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/v1/admin/properties/${propertyId}/invitations/${invitationId}`,
        { method: "DELETE", credentials: "same-origin" },
      );
      if (!response.ok) {
        const payload = await response.json() as { error?: string };
        throw new Error(payload.error || "ยกเลิกคำเชิญไม่สำเร็จ");
      }
      setMessage("ยกเลิกคำเชิญแล้ว");
      await load();
    } catch (cause) {
      setError(formatClientError(cause, "ยกเลิกคำเชิญไม่สำเร็จ"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="settings-section-stack grid gap-6">
      {error ? <p className="form-alert error" role="alert">{error}</p> : null}
      {message ? <output className="form-alert block">{message}</output> : null}

      {readOnly ? <ReadOnlyNotice>ดูและรีเฟรชประวัติคำเชิญได้ แต่ไม่สามารถสร้างหรือยกเลิกคำเชิญได้</ReadOnlyNotice> : <CreateInvitationSection
        copied={copied}
        createdCode={createdCode}
        expiresInDays={expiresInDays}
        intendedRole={intendedRole}
        loading={loading}
        onCopy={copyCode}
        onSubmit={createInvitation}
        roomId={roomId}
        rooms={rooms}
        setExpiresInDays={setExpiresInDays}
        setIntendedRole={setIntendedRole}
        setRoomId={setRoomId}
        submitting={submitting}
      />}

      <section className="panel settings-section">
        <div className="settings-section-head">
          <div>
            <h2>ประวัติคำเชิญ</h2>
            <p>ติดตามการรับคำเชิญ วันหมดอายุ และยกเลิกรหัสที่ยังไม่ถูกใช้</p>
          </div>
          <button
            aria-label="โหลดรายการคำเชิญใหม่"
            className="secondary-button"
            disabled={loading}
            onClick={() => void load()}
            type="button"
          >
            <RefreshCw className={loading ? "animate-spin" : ""} size={17} />
            รีเฟรช
          </button>
        </div>

        <InvitationList
          invitations={invitations}
          loading={loading}
          onRevoke={revoke}
          readOnly={readOnly}
          submitting={submitting}
        />

        {pageInfo?.hasNextPage ? <LoadMoreButton isLoading={loading} onClick={() => void load(pageInfo.page + 1, true)} /> : null}
      </section>
      {confirmationDialog}
    </div>
  );
}

// ฐานข้อมูลยังเก็บเป็น PENDING อยู่จนกว่าจะมีคนมาใช้ จึงต้องเทียบเวลาเองตอนแสดงผล
// ไม่งั้นใบที่หมดอายุไปแล้วจะยังโชว์ว่ารออยู่ และมีปุ่มยกเลิกที่กดไปก็ไม่มีความหมาย
function effectiveStatus(invitation: Invitation): Invitation["status"] {
  if (invitation.status === "PENDING" && new Date(invitation.expiresAt).getTime() <= Date.now()) {
    return "EXPIRED";
  }
  return invitation.status;
}

// ป้ายสถานะ ใช้แค่ในไฟล์นี้ จึงไม่ต้อง export
function InvitationStatus({ invitation }: Readonly<{ invitation: Invitation }>) {
  const status = effectiveStatus(invitation);
  // Record บังคับให้ครอบคลุมทุกสถานะตั้งแต่ตอนคอมไพล์ เพิ่มสถานะใหม่แล้วลืมแปลจะคอมไพล์ไม่ผ่าน
  const labels: Record<Invitation["status"], string> = {
    PENDING: "รอรับคำเชิญ",
    ACCEPTED: "รับแล้ว",
    EXPIRED: "หมดอายุ",
    REVOKED: "ยกเลิกแล้ว",
  };
  const styles: Record<Invitation["status"], string> = {
    PENDING: "bg-amber-100 text-amber-800",
    ACCEPTED: "bg-emerald-100 text-emerald-800",
    EXPIRED: "bg-slate-100 text-slate-700",
    REVOKED: "bg-red-100 text-red-700",
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${styles[status]}`}>{labels[status]}</span>;
}

// จัดรูปแบบวันเวลาแบบไทยไว้ที่เดียว ทุกที่ในหน้านี้จะได้แสดงเหมือนกัน
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

// ดึงรายการห้องและประวัติคำเชิญพร้อมกัน ไม่ต้องรอผลของกันและกัน
async function requestInvitationData(propertyId: string, page: number) {
  const [availableRooms, invitationPage] = await Promise.all([
    readData<RoomOption[]>(await fetch(`/api/v1/admin/properties/${propertyId}/rooms`, { cache: "no-store", credentials: "same-origin" })),
    requestInvitationPage(propertyId, page),
  ]);
  return { availableRooms, invitationPage };
}

async function requestInvitationPage(propertyId: string, page: number) {
  const response = await fetch(`/api/v1/admin/properties/${propertyId}/invitations?page=${page}&pageSize=20`, { cache: "no-store", credentials: "same-origin" });
  const payload = await readApiPayload<{
    data?: Invitation[];
    pageInfo?: PageInfo;
    error?: string;
    requestId?: string;
  }>(response, "โหลดรายการคำเชิญไม่สำเร็จ");
  // ตอบ 200 แต่ข้อมูลไม่ครบก็แสดงผลต่อไม่ได้ ต้องดักไว้ก่อน
  if (!payload.data || !payload.pageInfo) throw new Error("ข้อมูลคำเชิญที่ได้รับไม่ครบถ้วน");
  return { data: payload.data, pageInfo: payload.pageInfo };
}

// ฟอร์มสร้างคำเชิญ พร้อมกล่องแสดงรหัสที่เพิ่งสร้าง
function CreateInvitationSection({ copied, createdCode, expiresInDays, intendedRole, loading, onCopy, onSubmit, roomId, rooms, setExpiresInDays, setIntendedRole, setRoomId, submitting }: Readonly<{
  copied: boolean;
  createdCode: string;
  expiresInDays: number;
  intendedRole: "PRIMARY" | "CO_OCCUPANT";
  loading: boolean;
  onCopy: () => Promise<void>;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => Promise<void>;
  roomId: string;
  rooms: RoomOption[];
  setExpiresInDays: (days: number) => void;
  setIntendedRole: (role: "PRIMARY" | "CO_OCCUPANT") => void;
  setRoomId: (roomId: string) => void;
  submitting: boolean;
}>) {
  const hasRooms = rooms.length > 0;
  return <section className="panel settings-section">
    <div className="settings-section-head">
      <div>
        <h2>สร้างคำเชิญผู้เช่า</h2>
        <p>เลือกรูปแบบผู้พักและกำหนดอายุรหัสก่อนส่งให้ผู้เช่า</p>
      </div>
    </div>

    <form className="grid gap-4 lg:grid-cols-[1fr_220px_160px_auto]" onSubmit={onSubmit}>
      <DropdownField disabled={submitting || !hasRooms} label="ห้อง" onChange={setRoomId} options={rooms.map((room) => ({ label: `ห้อง ${room.number} · ${room.building.name} ชั้น ${room.floor.number}`, value: room.id }))} value={roomId} />
      <DropdownField disabled={submitting} label="สิทธิ์ผู้พัก" onChange={(value) => setIntendedRole(value as "PRIMARY" | "CO_OCCUPANT")} options={[{ label: "ผู้เช่าหลัก", value: "PRIMARY" }, { label: "ผู้พักร่วม", value: "CO_OCCUPANT" }]} value={intendedRole} />
      <DropdownField disabled={submitting} label="อายุรหัส" onChange={(value) => setExpiresInDays(Number(value))} options={[1, 3, 7, 14, 30].map((days) => ({ label: `${days} วัน`, value: String(days) }))} value={String(expiresInDays)} />
      <button
        aria-describedby={!submitting && !roomId ? "invitation-create-disabled-reason" : undefined}
        className="primary-button self-end"
        disabled={submitting || !roomId}
        type="submit"
      >
        <Send size={17} />
        {submitting ? "กำลังสร้าง..." : "สร้างคำเชิญ"}
      </button>
    </form>
    {!submitting && !roomId && hasRooms ? <p className="disabled-reason mt-3" id="invitation-create-disabled-reason">เลือกห้องที่จะเชิญผู้เช่าก่อนสร้างคำเชิญ</p> : null}
    {!loading && !hasRooms ? <p className="disabled-reason mt-4" id="invitation-create-disabled-reason">ยังไม่มีห้องที่ใช้สร้างคำเชิญ กรุณาสร้างห้องก่อน</p> : null}
    <CreatedCodeBox code={createdCode} copied={copied} onCopy={onCopy} />
  </section>;
}

// รหัสที่เพิ่งสร้าง แสดงครั้งเดียวเพราะระบบเก็บแค่ค่า hash
function CreatedCodeBox({ code, copied, onCopy }: Readonly<{ code: string; copied: boolean; onCopy: () => Promise<void> }>) {
  if (!code) return null;
  return <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
    <div className="flex items-start gap-3">
      <Link2 className="mt-1 shrink-0 text-emerald-700" size={20} />
      <div className="min-w-0 flex-1">
        <strong className="text-emerald-900">รหัสคำเชิญที่สร้างใหม่</strong>
        {/* บอกตรง ๆ ว่ารหัสแสดงครั้งเดียว ผู้ใช้จะได้คัดลอกก่อนปิดหน้า */}
        <p className="mt-1 text-sm text-emerald-800">รหัสจะแสดงครั้งนี้ครั้งเดียว ระบบจัดเก็บเฉพาะค่า hash และไม่สามารถเปิดดูย้อนหลังได้</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            aria-label="รหัสคำเชิญที่สร้างใหม่"
            className="min-w-0 flex-1 font-mono text-sm"
            // โฟกัสแล้วเลือกทั้งหมดให้เลย เผื่อคัดลอกอัตโนมัติไม่ได้จะได้กด Ctrl+C เองง่าย ๆ
            onFocus={(event) => event.currentTarget.select()}
            readOnly
            value={code}
          />
          <button className="secondary-button" onClick={() => void onCopy()} type="button">
            {copied ? <Check size={17} /> : <Clipboard size={17} />}
            {copied ? "คัดลอกแล้ว" : "คัดลอกรหัส"}
          </button>
        </div>
      </div>
    </div>
  </div>;
}

// ประวัติคำเชิญทั้งหมดของหอ
function InvitationList({ invitations, loading, onRevoke, readOnly, submitting }: Readonly<{
  invitations: Invitation[];
  loading: boolean;
  onRevoke: (invitationId: string) => Promise<void>;
  readOnly: boolean;
  submitting: boolean;
}>) {
  if (loading && invitations.length === 0) return <p className="py-10 text-center text-[#73757d]">กำลังโหลดรายการคำเชิญ...</p>;
  if (invitations.length === 0) return <p className="py-10 text-center text-[#73757d]">ยังไม่มีคำเชิญ</p>;
  return <div className="mt-4 grid gap-3">
    {invitations.map((invitation) => <article className="rounded-2xl border border-[#e3e4e8] p-4" key={invitation.id}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-lg">ห้อง {invitation.room.number}</strong>
            <InvitationStatus invitation={invitation} />
          </div>
          <p className="mt-1 text-sm text-[#73757d]">
            {invitation.intendedRole === "PRIMARY" ? "ผู้เช่าหลัก" : "ผู้พักร่วม"}
            {" · "}สร้าง {formatDateTime(invitation.createdAt)}
            {" · "}หมดอายุ {formatDateTime(invitation.expiresAt)}
          </p>
          {invitation.acceptedBy ? <p className="mt-2 text-sm">
            รับโดย <strong>{invitation.acceptedBy.user.displayName}</strong>
            {" · "}{invitation.acceptedBy.user.email}
          </p> : null}
        </div>
        {/* ยกเลิกได้เฉพาะใบที่ยังรออยู่จริง ใบที่หมดอายุหรือถูกใช้ไปแล้วไม่ต้องมีปุ่ม */}
        {effectiveStatus(invitation) === "PENDING" && !readOnly ? <button
          className="secondary-button text-red-700"
          disabled={submitting}
          onClick={() => void onRevoke(invitation.id)}
          type="button"
        >
          <XCircle size={17} />
          ยกเลิกคำเชิญ
        </button> : null}
      </div>
    </article>)}
  </div>;
}
