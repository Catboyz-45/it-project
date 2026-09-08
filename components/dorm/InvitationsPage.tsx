"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Invitations Page” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { FormEvent, useCallback, useEffect, useState } from "react";
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Room Option” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type RoomOption = {
  id: string;
  number: string;
  status: string;
  capacity: number;
  building: { name: string; code: string };
  floor: { number: number; label: string | null };
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Invitation” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Invitation = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
  intendedRole: "PRIMARY" | "CO_OCCUPANT";
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  room: { id: string; number: string };
  acceptedBy: { user: { displayName: string; email: string } } | null;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Page Info” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type PageInfo = {
  page: number;
  pageSize: number;
  hasNextPage: boolean;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Created Invitation” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type CreatedInvitation = {
  invitation: Invitation;
  invitationCode: string;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “read Data” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - response: ผลตอบกลับ HTTP ที่กำลังจัดเตรียม
 * ผลลัพธ์: คืนข้อมูลชนิด Promise<T> ตามสัญญา TypeScript ของฟังก์ชัน
 */
async function readData<T>(response: Response): Promise<T> {
  return readApiData<T>(response, "ดำเนินการไม่สำเร็จ");
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Invitations Page” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { propertyId, readOnly = false }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function InvitationsPage({ propertyId, readOnly = false }: { propertyId: string; readOnly?: boolean }) {
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
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

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “load” แล้วส่งผลที่เหมาะสมกลับไป
   * รับค่า:
   * - targetPage: ค่า “target Page” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - append: ค่า “append” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
   */
  const load = useCallback(async (targetPage = 1, append = false) => {
    setLoading(true);
    setError("");
    try {
      const [availableRooms, invitationResponse] = await Promise.all([
        readData<RoomOption[]>(await fetch(
          `/api/v1/admin/properties/${propertyId}/rooms`,
          { cache: "no-store", credentials: "same-origin" },
        )),
        fetch(
          `/api/v1/admin/properties/${propertyId}/invitations?page=${targetPage}&pageSize=20`,
          { cache: "no-store", credentials: "same-origin" },
        ).then(async (response) => {
          const payload = await readApiPayload<{
            data?: Invitation[];
            pageInfo?: PageInfo;
            error?: string;
            requestId?: string;
          }>(response, "โหลดรายการคำเชิญไม่สำเร็จ");
          if (!payload.data || !payload.pageInfo) throw new Error("ข้อมูลคำเชิญที่ได้รับไม่ครบถ้วน");
          return { data: payload.data, pageInfo: payload.pageInfo };
        }),
      ]);
      setRooms(availableRooms);
      setRoomId((current) => (
        availableRooms.some((room) => room.id === current)
          ? current
          : availableRooms[0]?.id ?? ""
      ));
      setInvitations((current) => append
        ? [...current, ...invitationResponse.data]
        : invitationResponse.data);
      setPageInfo(invitationResponse.pageInfo);
    } catch (cause) {
      setError(formatClientError(cause, "โหลดข้อมูลไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “create Invitation” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า:
   * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
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

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “copy Code” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(createdCode);
      setCopied(true);
      setMessage("คัดลอกรหัสคำเชิญแล้ว");
    } catch {
      setError("คัดลอกอัตโนมัติไม่สำเร็จ กรุณาเลือกรหัสแล้วคัดลอกด้วยตนเอง");
    }
  }

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “revoke” ตามกฎของระบบ
   * รับค่า:
   * - invitationId: รหัสภายในของ invitation
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  async function revoke(invitationId: string) {
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
      {message ? <p className="form-alert" role="status">{message}</p> : null}

      {readOnly ? <ReadOnlyNotice>ดูและรีเฟรชประวัติคำเชิญได้ แต่ไม่สามารถสร้างหรือยกเลิกคำเชิญได้</ReadOnlyNotice> : <section className="panel settings-section">
        <div className="settings-section-head">
          <div>
            <h2>สร้างคำเชิญผู้เช่า</h2>
            <p>เลือกรูปแบบผู้พักและกำหนดอายุรหัสก่อนส่งให้ผู้เช่า</p>
          </div>
        </div>

        <form className="grid gap-4 lg:grid-cols-[1fr_220px_160px_auto]" onSubmit={createInvitation}>
          <DropdownField disabled={submitting || rooms.length === 0} label="ห้อง" onChange={setRoomId} options={rooms.map((room) => ({ label: `ห้อง ${room.number} · ${room.building.name} ชั้น ${room.floor.number}`, value: room.id }))} value={roomId} />
          <DropdownField disabled={submitting} label="สิทธิ์ผู้พัก" onChange={(value) => setIntendedRole(value as typeof intendedRole)} options={[{ label: "ผู้เช่าหลัก", value: "PRIMARY" }, { label: "ผู้พักร่วม", value: "CO_OCCUPANT" }]} value={intendedRole} />
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
        {!submitting && !roomId && rooms.length > 0 ? (
          <p className="disabled-reason mt-3" id="invitation-create-disabled-reason">เลือกห้องที่จะเชิญผู้เช่าก่อนสร้างคำเชิญ</p>
        ) : null}
        {!loading && rooms.length === 0 ? (
          <p className="disabled-reason mt-4" id="invitation-create-disabled-reason">ยังไม่มีห้องที่ใช้สร้างคำเชิญ กรุณาสร้างห้องก่อน</p>
        ) : null}

        {createdCode ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <Link2 className="mt-1 shrink-0 text-emerald-700" size={20} />
              <div className="min-w-0 flex-1">
                <strong className="text-emerald-900">รหัสคำเชิญที่สร้างใหม่</strong>
                <p className="mt-1 text-sm text-emerald-800">
                  รหัสจะแสดงครั้งนี้ครั้งเดียว ระบบจัดเก็บเฉพาะค่า hash และไม่สามารถเปิดดูย้อนหลังได้
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    aria-label="รหัสคำเชิญที่สร้างใหม่"
                    className="min-w-0 flex-1 font-mono text-sm"
                    onFocus={(event) => event.currentTarget.select()}
                    readOnly
                    value={createdCode}
                  />
                  <button className="secondary-button" onClick={() => void copyCode()} type="button">
                    {copied ? <Check size={17} /> : <Clipboard size={17} />}
                    {copied ? "คัดลอกแล้ว" : "คัดลอกรหัส"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>}

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

        {loading && invitations.length === 0 ? (
          <p className="py-10 text-center text-[#73757d]">กำลังโหลดรายการคำเชิญ...</p>
        ) : invitations.length === 0 ? (
          <p className="py-10 text-center text-[#73757d]">ยังไม่มีคำเชิญ</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {invitations.map((invitation) => (
              <article className="rounded-2xl border border-[#e3e4e8] p-4" key={invitation.id}>
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
                    {invitation.acceptedBy ? (
                      <p className="mt-2 text-sm">
                        รับโดย <strong>{invitation.acceptedBy.user.displayName}</strong>
                        {" · "}{invitation.acceptedBy.user.email}
                      </p>
                    ) : null}
                  </div>
                  {effectiveStatus(invitation) === "PENDING" && !readOnly ? (
                    <button
                      className="secondary-button text-red-700"
                      disabled={submitting}
                      onClick={() => void revoke(invitation.id)}
                      type="button"
                    >
                      <XCircle size={17} />
                      ยกเลิกคำเชิญ
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}

        {pageInfo?.hasNextPage ? <LoadMoreButton isLoading={loading} onClick={() => void load(pageInfo.page + 1, true)} /> : null}
      </section>
      {confirmationDialog}
    </div>
  );
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “effective Status” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - invitation: ค่า “invitation” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลชนิด Invitation["status"] ตามสัญญา TypeScript ของฟังก์ชัน
 */
function effectiveStatus(invitation: Invitation): Invitation["status"] {
  if (invitation.status === "PENDING" && new Date(invitation.expiresAt).getTime() <= Date.now()) {
    return "EXPIRED";
  }
  return invitation.status;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Invitation Status” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { invitation }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function InvitationStatus({ invitation }: { invitation: Invitation }) {
  const status = effectiveStatus(invitation);
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แปลงข้อมูลในขั้นตอน “format Date Time” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
