"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Ticket Reply Thread” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, MessageSquareReply, Send } from "lucide-react";
import { ReadOnlyNotice } from "@/components/dorm/ReadOnlyNotice";
import { LoadMoreButton } from "@/components/ui/DataNavigation";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Reply” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Reply = {
  id: string;
  body: string;
  createdAt: string;
  authorUser: {
    id: string;
    displayName: string;
    role: "SUPER_ADMIN" | "PROPERTY_ADMIN" | "TENANT";
  } | null;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Ticket Reply Thread” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { endpoint, onRead, readOnly = false, viewerRole, }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function TicketReplyThread({
  endpoint,
  onRead,
  readOnly = false,
  viewerRole,
}: {
  endpoint: string;
  onRead?: () => void;
  readOnly?: boolean;
  viewerRole: "PROPERTY_ADMIN" | "TENANT";
}) {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const onReadRef = useRef(onRead);
  useEffect(() => { onReadRef.current = onRead; }, [onRead]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “load” แล้วส่งผลที่เหมาะสมกลับไป
   * รับค่า:
   * - targetPage: ค่า “target Page” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - prepend: ค่า “prepend” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const load = useCallback(async (targetPage = 1, prepend = false) => {
    if (prepend) setIsLoadingOlder(true);
    else setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`${endpoint}?page=${targetPage}&pageSize=30`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = await response.json() as {
        data?: Reply[];
        error?: string;
        pageInfo?: { page: number; hasNextPage: boolean };
      };
      if (!response.ok || !payload.data || !payload.pageInfo) {
        throw new Error(payload.error || "โหลดข้อความตอบกลับไม่สำเร็จ");
      }
      setReplies((current) => prepend ? [...payload.data!, ...current] : payload.data!);
      setPage(payload.pageInfo.page);
      setHasNextPage(payload.pageInfo.hasNextPage);
      onReadRef.current?.();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดข้อความตอบกลับไม่สำเร็จ");
    } finally {
      setIsLoading(false);
      setIsLoadingOlder(false);
    }
  }, [endpoint]);

  useEffect(() => { void load(); }, [load]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “submit” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า:
   * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const message = body.trim();
    if (!message || isSending) return;
    setIsSending(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: message }),
      });
      const payload = await response.json() as { data?: Reply; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "ส่งข้อความตอบกลับไม่สำเร็จ");
      setReplies((current) => [...current, payload.data!]);
      setBody("");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "ส่งข้อความตอบกลับไม่สำเร็จ");
    } finally {
      setIsSending(false);
    }
  };

  return <section className="mt-4 rounded-2xl border border-black/10 bg-black/[.025] p-4" aria-label="การสนทนาในรายการแจ้งเรื่อง">
    <div className="mb-3 flex items-center gap-2">
      <MessageSquareReply size={18} />
      <strong>การตอบกลับ</strong>
    </div>
    {error ? <p className="form-alert error" role="alert">{error}</p> : null}
    {isLoading ? <p className="flex items-center gap-2 py-4 text-sm"><LoaderCircle className="animate-spin" size={16} /> กำลังโหลดข้อความ...</p> : <>
      {hasNextPage ? <LoadMoreButton className="mb-3 border-t-0 p-0" isLoading={isLoadingOlder} label="โหลดข้อความก่อนหน้า" onClick={() => void load(page + 1, true)} /> : null}
      <div className="grid max-h-80 gap-2 overflow-y-auto" aria-live="polite">
        {replies.length === 0 ? <p className="py-4 text-center text-sm text-[#73757d]">ยังไม่มีข้อความตอบกลับ</p> : replies.map((reply) => {
          const isOwnSide = viewerRole === "TENANT"
            ? reply.authorUser?.role === "TENANT"
            : reply.authorUser?.role === "PROPERTY_ADMIN" || reply.authorUser?.role === "SUPER_ADMIN";
          return <article className={`max-w-[85%] rounded-2xl p-3 ${isOwnSide ? "ml-auto bg-brand text-white" : "bg-white"}`} key={reply.id}>
            <strong className="block text-xs">{reply.authorUser?.displayName ?? "ผู้ใช้ที่ถูกลบ"}</strong>
            <p className="whitespace-pre-wrap break-words">{reply.body}</p>
            <time className="mt-1 block text-xs opacity-65">{new Date(reply.createdAt).toLocaleString("th-TH")}</time>
          </article>;
        })}
      </div>
    </>}
    {!readOnly ? <form className="mt-3 flex gap-2" onSubmit={submit}>
      <label className="sr-only" htmlFor={`ticket-reply-${endpoint}`}>ข้อความตอบกลับ</label>
      <input
        className="min-w-0 flex-1 rounded-xl border border-black/15 bg-white px-3 py-2 text-[#292a30]"
        id={`ticket-reply-${endpoint}`}
        maxLength={4000}
        onChange={(event) => setBody(event.target.value)}
        placeholder="พิมพ์ข้อความตอบกลับ..."
        value={body}
      />
      <button aria-describedby={!isSending && !body.trim() ? `ticket-reply-disabled-reason-${endpoint}` : undefined} className="primary-button" disabled={isSending || !body.trim()} type="submit">
        {isSending ? <LoaderCircle className="animate-spin" size={16} /> : <Send size={16} />} ส่ง
      </button>
      {!isSending && !body.trim() ? <span className="sr-only" id={`ticket-reply-disabled-reason-${endpoint}`}>พิมพ์ข้อความตอบกลับก่อนกดส่ง</span> : null}
    </form> : <ReadOnlyNotice className="mt-3">อ่านประวัติการตอบกลับได้ แต่ไม่สามารถส่งข้อความใหม่ได้</ReadOnlyNotice>}
  </section>;
}
