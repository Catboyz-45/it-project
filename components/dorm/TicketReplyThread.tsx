"use client";
// โหลดและส่งข้อความจากเบราว์เซอร์ พร้อมเก็บสถานะของฟอร์ม

import { SyntheticEvent, useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, MessageSquareReply, Send } from "lucide-react";
import { ReadOnlyNotice } from "@/components/dorm/ReadOnlyNotice";
import { LoadMoreButton } from "@/components/ui/DataNavigation";

// ข้อความตอบกลับหนึ่งข้อความที่ API ส่งมา
type Reply = {
  id: string;
  body: string;
  createdAt: string;
  // เป็น null ได้เมื่อบัญชีคนเขียนถูกลบไปแล้ว แต่ข้อความยังอยู่
  authorUser: {
    id: string;
    displayName: string;
    role: "SUPER_ADMIN" | "PROPERTY_ADMIN" | "TENANT";
  } | null;
};

// กล่องสนทนาใต้รายการแจ้งเรื่อง ใช้ได้ทั้งฝั่งผู้เช่าและฝั่งเจ้าของหอ
export function TicketReplyThread({
  // ส่ง URL เข้ามาต่างกันตามบทบาท ตัวคอมโพเนนต์จึงไม่ต้องรู้ว่าใครเป็นคนดู
  endpoint,
  onRead,
  readOnly = false,
  viewerRole,
}: Readonly<{
  endpoint: string;
  onRead?: () => void;
  readOnly?: boolean;
  viewerRole: "PROPERTY_ADMIN" | "TENANT";
}>) {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  // เก็บ onRead ไว้ใน ref เพราะ load ข้างล่างไม่ควรรันใหม่ทุกครั้งที่หน้าแม่ส่งฟังก์ชันตัวใหม่มา
  const onReadRef = useRef(onRead);
  useEffect(() => { onReadRef.current = onRead; }, [onRead]);
  // แจ้งว่าอ่านแล้วครั้งเดียวต่อหนึ่งเรื่อง ไม่ใช่ทุกครั้งที่โหลดข้อความ
  // เพราะหน้าแม่ตอบสนองด้วยการโหลดรายการใหม่ แจ้งซ้ำจึงกลายเป็นวนกันไปมา
  const reportedReadFor = useRef<string | null>(null);

  // prepend = โหลดข้อความเก่ากว่ามาต่อข้างบน ไม่ใช่โหลดใหม่ทั้งชุด
  const load = useCallback(async (targetPage = 1, prepend = false) => {
    // แยกสถานะโหลดสองตัว จะได้ไม่ทำให้ข้อความที่อ่านอยู่หายไปตอนกดโหลดเพิ่ม
    if (prepend) setIsLoadingOlder(true);
    else setIsLoading(true);
    setError("");
    try {
      // no-store เพราะข้อความใหม่เข้ามาเรื่อย ๆ ไม่ควรได้ของเก่าจาก cache
      // same-origin ให้คุกกี้ session ติดไปด้วย เซิร์ฟเวอร์จะได้รู้ว่าใครขอ
      const response = await fetch(`${endpoint}?page=${targetPage}&pageSize=30`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = await response.json() as {
        data?: Reply[];
        error?: string;
        pageInfo?: { page: number; hasNextPage: boolean };
      };
      // เช็คทั้งสถานะและตัวข้อมูล เพราะตอบ 200 แต่ข้อมูลไม่ครบก็แสดงผลต่อไม่ได้
      if (!response.ok || !payload.data || !payload.pageInfo) {
        throw new Error(payload.error || "โหลดข้อความตอบกลับไม่สำเร็จ");
      }
      // ข้อความเก่าต่อข้างหน้า ส่วนการโหลดใหม่แทนที่ทั้งชุด
      setReplies((current) => prepend ? [...payload.data!, ...current] : payload.data!);
      setPage(payload.pageInfo.page);
      setHasNextPage(payload.pageInfo.hasNextPage);
      // บอกหน้าแม่ว่าอ่านแล้ว เพื่อให้ตัวเลขแจ้งเตือนลดลง
      if (reportedReadFor.current !== endpoint) {
        reportedReadFor.current = endpoint;
        onReadRef.current?.();
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดข้อความตอบกลับไม่สำเร็จ");
    } finally {
      setIsLoading(false);
      setIsLoadingOlder(false);
    }
  }, [endpoint]);

  // โหลดครั้งแรกเมื่อเปิด และโหลดใหม่เมื่อเปลี่ยนไปดูรายการอื่น
  useEffect(() => { void load(); }, [load]);

  const submit = async (event: SyntheticEvent) => {
    // กันเบราว์เซอร์รีเฟรชหน้าตามพฤติกรรมฟอร์มปกติ
    event.preventDefault();
    const message = body.trim();
    // ข้อความว่างหรือกำลังส่งอยู่ก็ไม่ต้องยิงซ้ำ
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
      // ต่อข้อความที่เซิร์ฟเวอร์ตอบกลับมา ไม่ใช่ที่พิมพ์ไว้ จะได้ได้ id กับเวลาที่ถูกต้อง
      setReplies((current) => [...current, payload.data!]);
      // ล้างช่องพิมพ์เมื่อส่งสำเร็จเท่านั้น ส่งไม่ผ่านข้อความจะได้ยังอยู่ให้กดส่งใหม่
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
      {/* aria-live ให้โปรแกรมอ่านหน้าจออ่านข้อความใหม่ที่เข้ามาเอง โดยไม่ต้องเลื่อนไปหา */}
      <div className="grid max-h-80 gap-2 overflow-y-auto" aria-live="polite">
        {replies.length === 0 ? <p className="py-4 text-center text-sm text-[#73757d]">ยังไม่มีข้อความตอบกลับ</p> : replies.map((reply) => {
          // ข้อความฝั่งตัวเองชิดขวาและเป็นสีแบรนด์ ฝั่งตรงข้ามชิดซ้ายพื้นขาว
          const isOwnSide = viewerRole === "TENANT"
            ? reply.authorUser?.role === "TENANT"
            : reply.authorUser?.role === "PROPERTY_ADMIN" || reply.authorUser?.role === "SUPER_ADMIN";
          return <article className={`max-w-[85%] rounded-2xl p-3 ${isOwnSide ? "ml-auto bg-brand text-white" : "bg-white"}`} key={reply.id}>
            <strong className="block text-xs">{reply.authorUser?.displayName ?? "ผู้ใช้ที่ถูกลบ"}</strong>
            {/* pre-wrap คงการขึ้นบรรทัดที่ผู้ใช้พิมพ์ break-words กันข้อความยาวรวดเดียวดันกล่องจนล้น */}
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
        // จำกัดความยาวให้ตรงกับที่เซิร์ฟเวอร์ยอมรับ จะได้รู้ตั้งแต่ตอนพิมพ์ ไม่ใช่ตอนกดส่งแล้วโดนปฏิเสธ
        maxLength={4000}
        onChange={(event) => setBody(event.target.value)}
        placeholder="พิมพ์ข้อความตอบกลับ..."
        value={body}
      />
      {/* ปุ่มที่กดไม่ได้ต้องบอกเหตุผลด้วย ไม่งั้นคนใช้โปรแกรมอ่านหน้าจอจะไม่รู้ว่าติดอะไร */}
      <button aria-describedby={!isSending && !body.trim() ? `ticket-reply-disabled-reason-${endpoint}` : undefined} className="primary-button" disabled={isSending || !body.trim()} type="submit">
        {isSending ? <LoaderCircle className="animate-spin" size={16} /> : <Send size={16} />} ส่ง
      </button>
      {!isSending && !body.trim() ? <span className="sr-only" id={`ticket-reply-disabled-reason-${endpoint}`}>พิมพ์ข้อความตอบกลับก่อนกดส่ง</span> : null}
    </form> : <ReadOnlyNotice className="mt-3">อ่านประวัติการตอบกลับได้ แต่ไม่สามารถส่งข้อความใหม่ได้</ReadOnlyNotice>}
  </section>;
}
