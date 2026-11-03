"use client";
// คุยในเรื่องแจ้งซ่อมหรือร้องเรียนจากหน้าต่างแชทเล็ก หน้าตาเหมือนแชท แต่ข้อความยังผูกกับเรื่องนั้นเหมือนเดิม
// ใช้ API ตอบกลับของเรื่องแจ้งตัวเดิม เจ้าของหอกับผู้เช่าต่างกันแค่ที่อยู่ API และฝั่งของข้อความ

import { SyntheticEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquareWarning, Paperclip, Wrench } from "lucide-react";
import { ChatComposer, ChatEmptyState, ChatMessageList } from "@/components/chat/ChatParts";
import type { ChatThreadMessage } from "@/components/chat/use-chat-thread";
import { ReadOnlyNotice } from "@/components/dorm/ReadOnlyNotice";
import { chatDayLabel, chatListTime, chatTime } from "@/lib/chat-time";
import { closedTicketNotice, ticketAcceptsReplies, type TicketInboxItem } from "@/lib/ticket-inbox";
import { formatTicketStatus } from "@/lib/ui-labels";


type Reply = {
  id: string;
  body: string;
  createdAt: string;
  authorUser: { id: string; displayName: string; role: "SUPER_ADMIN" | "PROPERTY_ADMIN" | "TENANT" } | null;
};

// โหลดข้อความใหม่ทุก 10 วินาทีระหว่างเปิดอยู่ เรื่องแจ้งไม่มีสตรีมแบบแชท แต่ก็ไม่ต้องรอนาน
const pollIntervalMs = 10_000;

export function ticketTypeLabel(type: TicketInboxItem["type"]) {
  return type === "REPAIR" ? "แจ้งซ่อม" : "ร้องเรียน";
}

// สีของป้ายสถานะ เสร็จแล้วเขียว ยกเลิกเทา ที่เหลือคือยังต้องทำอยู่เป็นเหลือง
export function ticketStatusTone(status: TicketInboxItem["status"]) {
  if (status === "RESOLVED") return "done";
  if (status === "CANCELLED") return "neutral";
  return "pending";
}

export function TicketIcon({ size = 18, type }: Readonly<{ size?: number; type: TicketInboxItem["type"] }>) {
  return type === "REPAIR" ? <Wrench aria-hidden="true" size={size} /> : <MessageSquareWarning aria-hidden="true" size={size} />;
}

// ขั้นถัดไปที่กดได้จากในแชท เหมือนปุ่มเลื่อนสถานะในหน้าแจ้งซ่อม รับเรื่องก่อนแล้วจึงปิดงานได้
function nextStatusAction(status: TicketInboxItem["status"]) {
  if (status === "OPEN") return { label: "รับเรื่องและเริ่มตรวจสอบ", status: "ACKNOWLEDGED" as const };
  if (status === "ACKNOWLEDGED" || status === "IN_PROGRESS") return { label: "ทำเครื่องหมายว่าเสร็จ", status: "RESOLVED" as const };
  return null;
}

export function TicketChatThread({
  attachmentBase,
  endpoint,
  inputRef,
  onRead,
  onStatusChange,
  readOnly,
  ticket,
  viewer,
}: Readonly<{
  // ที่อยู่ไฟล์แนบของเรื่องนี้ ไม่รวม id ไฟล์
  attachmentBase: string;
  // API ตอบกลับของเรื่องนี้
  endpoint: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onRead?: () => unknown;
  // เจ้าของหอเลื่อนสถานะได้จากในแชท ผู้เช่าไม่ส่งมา ปุ่มจะไม่ขึ้น
  onStatusChange?: (status: "ACKNOWLEDGED" | "RESOLVED") => Promise<void>;
  readOnly: boolean;
  ticket: TicketInboxItem;
  viewer: "ADMIN" | "TENANT";
}>) {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onReadRef = useRef(onRead);
  useEffect(() => { onReadRef.current = onRead; }, [onRead]);
  const reportedRead = useRef(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`${endpoint}?page=1&pageSize=50`, { cache: "no-store", credentials: "same-origin", signal });
      const payload = await response.json() as { data?: Reply[]; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "โหลดข้อความไม่สำเร็จ");
      // รวมกับที่มีอยู่ ข้อความที่เพิ่งส่งระหว่างโหลดจะได้ไม่หายไปตอนผลโหลดมาทับ
      setReplies((current) => {
        const fromServer = new Set(payload.data!.map((reply) => reply.id));
        return [...payload.data!, ...current.filter((reply) => !fromServer.has(reply.id))]
          .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
      });
      setError("");
      // เปิดอ่านแล้ว ให้ตัวเลขบนกระดิ่งกับรายชื่อลดลง แจ้งครั้งเดียวต่อการเปิดเรื่องหนึ่งครั้ง
      if (!reportedRead.current) {
        reportedRead.current = true;
        void onReadRef.current?.();
      }
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "โหลดข้อความไม่สำเร็จ");
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const timer = window.setInterval(() => void load(controller.signal), pollIntervalMs);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [load]);

  // มีข้อความใหม่ก็เลื่อนลงล่างสุด เหมือนแชทปกติ
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [replies.length]);

  // รวมข้อความกับการเปลี่ยนสถานะเป็นเส้นเวลาเดียว ข้อความของหอทุกคนอยู่ฝั่งเดียวกัน
  const timeline = useMemo<ChatThreadMessage[]>(() => [
    ...replies.map((reply) => ({
      id: reply.id,
      body: reply.body,
      senderRole: reply.authorUser?.role === "TENANT" ? "TENANT" as const : "ADMIN" as const,
      senderName: reply.authorUser?.displayName ?? "ผู้ใช้ที่ถูกลบ",
      createdAt: reply.createdAt,
      attachment: null,
    })),
    ...ticket.statusEvents.map((event) => ({
      id: `event-${event.id}`,
      body: `เปลี่ยนสถานะเป็น ${formatTicketStatus(event.toValue)}`,
      senderRole: "ADMIN" as const,
      senderName: "",
      createdAt: event.createdAt,
      attachment: null,
      isEvent: true,
    })),
  ].sort((left, right) => left.createdAt.localeCompare(right.createdAt)), [replies, ticket.statusEvents]);

  const send = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = message.trim();
    if (!body || isSending) return;
    setIsSending(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const payload = await response.json() as { data?: Reply; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "ส่งข้อความไม่สำเร็จ");
      setReplies((current) => [...current, payload.data!]);
      // ล้างช่องเมื่อส่งสำเร็จเท่านั้น ส่งไม่ผ่านข้อความจะยังอยู่ให้กดส่งใหม่
      setMessage("");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "ส่งข้อความไม่สำเร็จ");
    } finally {
      setIsSending(false);
    }
  };

  const action = onStatusChange && !readOnly ? nextStatusAction(ticket.status) : null;
  const changeStatus = async () => {
    if (!action || !onStatusChange) return;
    setIsChangingStatus(true);
    setError("");
    try {
      await onStatusChange(action.status);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "เปลี่ยนสถานะไม่สำเร็จ");
    } finally {
      setIsChangingStatus(false);
    }
  };
  const isClosed = !ticketAcceptsReplies(ticket.status, viewer);

  return <>
    <div className="chat-widget-body">
      <ChatMessageList
        emptyState={<ChatEmptyState
          description={viewer === "ADMIN" ? "ตอบผู้แจ้งได้ที่นี่ ข้อความจะเก็บไว้กับเรื่องนี้" : "ถามความคืบหน้าหรือเพิ่มรายละเอียดได้ที่นี่"}
          title="ยังไม่มีข้อความในเรื่องนี้"
        />}
        endRef={endRef}
        hasOlderMessages={false}
        isLoading={isLoading}
        isLoadingOlder={false}
        leading={<TicketSummaryCard attachmentBase={attachmentBase} ticket={ticket} />}
        messages={timeline}
        onLoadOlder={() => undefined}
        ownRole={viewer}
        scrollRef={scrollRef}
      />
    </div>
    {error ? <p className="chat-error mx-3 mb-2" role="alert">{error}</p> : null}
    {action ? <div className="chat-ticket-actions">
      <button disabled={isChangingStatus} onClick={() => void changeStatus()} type="button">{isChangingStatus ? "กำลังบันทึก..." : action.label}</button>
    </div> : null}
    {readOnly || isClosed
      ? <ReadOnlyNotice className="m-3">{isClosed ? closedTicketNotice(ticket.status) : "อ่านประวัติการตอบกลับได้ แต่ไม่สามารถส่งข้อความใหม่ได้"}</ReadOnlyNotice>
      : <ChatComposer
        attachment={null}
        canAttach={false}
        error=""
        fileInputRef={fileInputRef}
        inputLabel="ข้อความตอบกลับ"
        inputRef={inputRef}
        // ตอบได้ทันทีไม่ต้องรอข้อความเก่าโหลดเสร็จ การตอบไม่ได้ขึ้นกับข้อความก่อนหน้า
        isReady
        isSending={isSending}
        message={message}
        onSubmit={send}
        placeholder="พิมพ์ข้อความตอบกลับ..."
        setAttachment={() => undefined}
        setError={setError}
        setMessage={setMessage}
      />}
  </>;
}

// การ์ดบนสุดของห้องสนทนา บอกว่าแจ้งเรื่องอะไรไว้ พร้อมไฟล์แนบ
function TicketSummaryCard({ attachmentBase, ticket }: Readonly<{ attachmentBase: string; ticket: TicketInboxItem }>) {
  return <section aria-label="เรื่องที่แจ้ง" className="chat-ticket-summary">
    <p><strong>เรื่องที่แจ้ง</strong> · {chatDayLabel(ticket.createdAt)} {chatTime(ticket.createdAt)}</p>
    <p className="whitespace-pre-wrap">{ticket.detail}</p>
    {ticket.attachments.length ? <div className="chat-ticket-files">
      {ticket.attachments.map((file) => <a href={`${attachmentBase}/${file.id}`} key={file.id} rel="noreferrer" target="_blank">
        <Paperclip aria-hidden="true" size={13} /> {file.fileName}
      </a>)}
    </div> : null}
  </section>;
}

// แถวของเรื่องแจ้งในกล่องข้อความรวม ไอคอนสี่เหลี่ยมตามประเภท แยกจากแชทที่เป็นวงกลม พร้อมป้ายประเภทและสถานะ
// place บอกที่มาของเรื่องในบรรทัดชื่อ otherPrefix ใส่หน้าข้อความล่าสุดของอีกฝั่ง เช่นผู้เช่าเห็น "หอ: …"
export function TicketInboxRow({ onOpen, otherPrefix = "", place, ticket }: Readonly<{
  onOpen: (ticketId: string) => void;
  otherPrefix?: string;
  place: string;
  ticket: TicketInboxItem;
}>) {
  const last = ticket.lastMessage;
  const preview = last ? `${last.fromSelf ? "คุณ: " : otherPrefix}${last.body}` : "ยังไม่มีข้อความ";
  return <button aria-label={`${ticketTypeLabel(ticket.type)} ${ticket.title}${place ? ` ${place}` : ""} ${formatTicketStatus(ticket.status)}${ticket.hasUnread ? " มีข้อความใหม่" : ""}`} className="chat-ticket-row" data-unread={ticket.hasUnread || undefined} onClick={() => onOpen(ticket.id)} type="button">
    <span aria-hidden="true" className="chat-ticket-icon" data-tone={ticketStatusTone(ticket.status)}><TicketIcon type={ticket.type} /></span>
    <span className="chat-contact-text">
      <span className="chat-contact-line">
        <strong>{ticket.title}{place ? ` · ${place}` : ""}</strong>
        <small>{chatListTime(ticket.lastActivityAt)}</small>
      </span>
      <span className="chat-contact-line">
        <small className="chat-contact-preview">{preview}</small>
        {ticket.hasUnread ? <span aria-hidden="true" className="chat-unread-dot" /> : null}
      </span>
      <span className="chat-ticket-tags">
        <span>{ticketTypeLabel(ticket.type)}</span>
        <span className="chat-ticket-status" data-tone={ticketStatusTone(ticket.status)}>{formatTicketStatus(ticket.status)}</span>
      </span>
    </span>
  </button>;
}
