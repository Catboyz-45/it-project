"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Super Admin Chat Widget” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  Building2,
  ChevronDown,
  ChevronLeft,
  Expand,
  FileText,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Send,
  Shrink,
  X,
} from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { LoadMoreButton } from "@/components/ui/DataNavigation";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Support Conversation” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type SupportConversation = {
  id: string;
  propertyId: string;
  propertyName: string;
  lastMessageAt: string | null;
  unreadCount: number;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Support Message” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type SupportMessage = {
  id: string;
  body: string;
  senderRole: "ADMIN" | "TENANT" | "SUPER_ADMIN";
  senderName: string;
  createdAt: string;
  attachment: { name: string; mimeType: string; size: number; url: string } | null;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Super Admin Chat Widget” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function SuperAdminChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [selected, setSelected] = useState<SupportConversation | null>(null);
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const shouldScrollToEndRef = useRef(true);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “load Conversations” แล้วส่งผลที่เหมาะสมกลับไป
   * รับค่า:
   * - targetPage: ค่า “target Page” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - append: ค่า “append” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const loadConversations = useCallback(async (targetPage = 1, append = false) => {
    if (append) setIsLoadingMore(true);
    else setIsLoadingList(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/super-admin/support-chat?page=${targetPage}&pageSize=50`, { cache: "no-store" });
      const result = await response.json() as {
        conversations?: SupportConversation[];
        pageInfo?: { hasNextPage: boolean; page: number };
        error?: string;
      };
      if (!response.ok || !result.conversations || !result.pageInfo) throw new Error(result.error || "โหลดรายการสนทนาไม่สำเร็จ");
      setConversations((current) => append
        ? [...current, ...result.conversations!.filter((item) => !current.some((existing) => existing.id === item.id))]
        : result.conversations!);
      setPage(result.pageInfo.page);
      setHasNextPage(result.pageInfo.hasNextPage);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดรายการสนทนาไม่สำเร็จ");
    } finally {
      setIsLoadingList(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => { void loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    setIsLoadingMessages(true);
    setError("");
    void fetch(`/api/v1/super-admin/properties/${selected.propertyId}/support-chat`, {
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      const result = await response.json() as { conversationId?: string; error?: string; hasMore?: boolean; messages?: SupportMessage[] };
      if (!response.ok || !result.messages || !result.conversationId) throw new Error(result.error || "โหลดข้อความไม่สำเร็จ");
      setMessages(result.messages);
      setConversationId(result.conversationId);
      setHasOlderMessages(result.hasMore ?? false);
      setConversations((current) => current.map((item) => item.id === selected.id ? { ...item, unreadCount: 0 } : item));
    }).catch((loadError) => {
      if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "โหลดข้อความไม่สำเร็จ");
    }).finally(() => {
      if (!controller.signal.aborted) setIsLoadingMessages(false);
    });
    return () => controller.abort();
  }, [selected]);

  useEffect(() => {
    if (!isOpen || !selected || !conversationId) return;
    const stream = new EventSource(`/api/v1/chat/conversations/${conversationId}/stream?propertyId=${encodeURIComponent(selected.propertyId)}&after=${encodeURIComponent(new Date().toISOString())}`);
    stream.onmessage = (event) => {
      try {
        const next = JSON.parse(event.data) as SupportMessage;
        setMessages((current) => current.some((item) => item.id === next.id) ? current : [...current, next]);
      } catch {
        setError("รับข้อความใหม่ไม่สำเร็จ");
      }
    };
    stream.onerror = () => setError("การเชื่อมต่อเรียลไทม์ขัดข้อง ระบบกำลังเชื่อมต่อใหม่");
    stream.onopen = () => setError("");
    return () => stream.close();
  }, [conversationId, isOpen, selected]);

  useEffect(() => {
    if (shouldScrollToEndRef.current) endRef.current?.scrollIntoView({ behavior: "smooth" });
    shouldScrollToEndRef.current = true;
  }, [messages]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “load Older Messages” แล้วส่งผลที่เหมาะสมกลับไป
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const loadOlderMessages = async () => {
    const oldest = messages[0];
    if (!selected || !oldest || isLoadingOlder) return;
    setIsLoadingOlder(true); setError("");
    const container = scrollRef.current;
    const previousHeight = container?.scrollHeight ?? 0;
    try {
      const search = new URLSearchParams({ beforeMessageId: oldest.id, limit: "50" });
      const response = await fetch(`/api/v1/super-admin/properties/${selected.propertyId}/support-chat?${search}`, { cache: "no-store" });
      const result = await response.json() as { error?: string; hasMore?: boolean; messages?: SupportMessage[] };
      if (!response.ok || !result.messages) throw new Error(result.error || "โหลดข้อความก่อนหน้าไม่สำเร็จ");
      shouldScrollToEndRef.current = false;
      setMessages((current) => [...result.messages!.filter((item) => !current.some((existing) => existing.id === item.id)), ...current]);
      setHasOlderMessages(result.hasMore ?? false);
      requestAnimationFrame(() => {
        if (container) container.scrollTop += container.scrollHeight - previousHeight;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดข้อความก่อนหน้าไม่สำเร็จ");
    } finally { setIsLoadingOlder(false); }
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “send Message” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า:
   * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
   * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
   */
  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = message.trim();
    if ((!body && !attachment) || !selected || !conversationId || isSending) return;
    setIsSending(true); setError("");
    try {
      const clientId = crypto.randomUUID();
      const response = attachment
        ? await fetch(`/api/v1/chat/conversations/${conversationId}/attachments`, {
          method: "POST",
          headers: { "x-property-id": selected.propertyId },
          body: (() => {
            const formData = new FormData();
            formData.set("propertyId", selected.propertyId);
            formData.set("body", body);
            formData.set("clientId", clientId);
            formData.set("file", attachment);
            return formData;
          })(),
        })
        : await fetch(`/api/v1/super-admin/properties/${selected.propertyId}/support-chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body, clientId }),
        });
      const result = await response.json() as { error?: string; message?: SupportMessage };
      if (!response.ok || !result.message) throw new Error(result.error || "ส่งข้อความไม่สำเร็จ");
      setMessages((current) => current.some((item) => item.id === result.message!.id) ? current : [...current, result.message!]);
      setMessage("");
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "ส่งข้อความไม่สำเร็จ");
    } finally { setIsSending(false); }
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “unread Count” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - sum: ค่า “sum” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - item: ค่า “item” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const unreadCount = conversations.reduce((sum, item) => sum + item.unreadCount, 0);

  if (!isOpen) return <IconButton className="chat-launcher" label="เปิดข้อความจากหอพัก" onClick={() => setIsOpen(true)} size="lg" variant="primary">
    <MessageSquare aria-hidden="true" size={24} />
    {unreadCount > 0 ? <span className="chat-notification-badge" aria-label={`${unreadCount} ข้อความที่ยังไม่ได้อ่าน`}>{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
  </IconButton>;

  return <>
    <aside aria-label="ข้อความจากหอพัก" className={`chat-widget${selected ? " chat-mode" : ""}${isExpanded ? " expanded" : ""}`}>
      <header className="chat-widget-header">
        <IconButton label={selected ? "กลับไปยังรายชื่อหอพัก" : "ย่อหน้าต่างแชท"} onClick={() => selected ? setSelected(null) : setIsOpen(false)}>
          <ChevronLeft aria-hidden="true" size={22} />
        </IconButton>
        <div className="chat-conversation-brand">
          {selected ? <span className="chat-person-avatar support"><Building2 aria-hidden="true" size={19} /></span> : null}
          <strong>{selected?.propertyName ?? "ข้อความจากหอพัก"}</strong>
        </div>
        <div className="chat-header-actions">
          <div className="chat-options">
            <IconButton aria-expanded={isOptionsOpen} label="ตัวเลือกหน้าต่างแชท" onClick={() => setIsOptionsOpen((current) => !current)}><MoreHorizontal aria-hidden="true" size={22} /></IconButton>
            {isOptionsOpen ? <div className="chat-options-menu"><button onClick={() => { setIsExpanded((current) => !current); setIsOptionsOpen(false); }} type="button">
              {isExpanded ? <Shrink aria-hidden="true" size={18} /> : <Expand aria-hidden="true" size={18} />}{isExpanded ? "ย่อหน้าต่าง" : "ขยายหน้าต่าง"}
            </button></div> : null}
          </div>
          <IconButton label="ปิดหน้าต่างข้อความ" onClick={() => setIsOpen(false)}><X aria-hidden="true" size={22} /></IconButton>
        </div>
      </header>

      {error && !selected ? <p className="chat-error mx-3 mt-3" role="alert">{error}</p> : null}

      <div className="chat-widget-body">
        {!selected ? <div className="chat-tenant-list">
          {isLoadingList ? <p className="chat-conversation-prompt py-8">กำลังโหลดรายการสนทนา...</p> : null}
          {!isLoadingList && conversations.length === 0 ? <p className="chat-conversation-prompt py-8">ยังไม่มีข้อความจากหอพัก</p> : null}
          {conversations.map((conversation) => <button key={conversation.id} onClick={() => { setSelected(conversation); setIsOptionsOpen(false); }} type="button">
            <span className="chat-list-avatar support"><Building2 aria-hidden="true" size={19} /></span>
            <span className="min-w-0 flex-1"><strong className="block truncate">{conversation.propertyName}</strong><small>{conversation.lastMessageAt ? `ล่าสุด ${new Date(conversation.lastMessageAt).toLocaleString("th-TH")}` : "ยังไม่มีข้อความ"}</small></span>
            {conversation.unreadCount > 0 ? <span className="notification-badge">{conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}</span> : null}
          </button>)}
          {hasNextPage ? <LoadMoreButton isLoading={isLoadingMore} label="โหลดหอพักเพิ่มเติม" onClick={() => void loadConversations(page + 1, true)} /> : null}
        </div> : (
          <div className="chat-conversation" ref={scrollRef}>
            {isLoadingMessages ? <p className="chat-conversation-prompt">กำลังโหลดข้อความ...</p> : null}
            {!isLoadingMessages && hasOlderMessages ? <LoadMoreButton className="mb-3 border-t-0 p-0" isLoading={isLoadingOlder} label="โหลดข้อความก่อนหน้า" onClick={() => void loadOlderMessages()} /> : null}
            {!isLoadingMessages && messages.length === 0 ? <p className="chat-conversation-prompt">ยังไม่มีข้อความ เริ่มสนทนากับหอพักได้เลย</p> : null}
            {messages.map((item) => <article className={`chat-message ${item.senderRole === "SUPER_ADMIN" ? "from-admin" : "from-tenant"}`} key={item.id}>
              <strong>{item.senderName}</strong>
              {item.body ? <p>{item.body}</p> : null}
              {item.attachment ? item.attachment.mimeType.startsWith("image/") ? <a className="chat-image-attachment" href={item.attachment.url} rel="noreferrer" target="_blank"><Image alt={item.attachment.name} height={240} src={item.attachment.url} unoptimized width={320} /></a> : <a className="chat-file-attachment" href={item.attachment.url} rel="noreferrer" target="_blank"><FileText aria-hidden="true" size={22} /><span><strong>{item.attachment.name}</strong><small>{(item.attachment.size / 1024).toFixed(1)} KB</small></span></a> : null}
              <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</time>
            </article>)}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {selected ? <form className="chat-composer" onSubmit={sendMessage}>
        {error ? <p className="chat-error" role="alert">{error}</p> : null}
        {attachment ? <div className="chat-attachment-preview"><FileText aria-hidden="true" size={18} /><span>{attachment.name}</span><IconButton label="นำไฟล์แนบออก" onClick={() => { setAttachment(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} size="sm"><X aria-hidden="true" size={16} /></IconButton></div> : null}
        <div>
          <input accept="image/png,image/jpeg,image/webp,application/pdf" className="chat-file-input" onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            if (file && file.size > 5 * 1024 * 1024) { setError("ไฟล์ต้องมีขนาดไม่เกิน 5 MB"); event.target.value = ""; return; }
            setError(""); setAttachment(file);
          }} ref={fileInputRef} type="file" />
          <IconButton className="chat-attach-button" disabled={isSending} label="แนบรูปหรือไฟล์" onClick={() => fileInputRef.current?.click()}><Paperclip aria-hidden="true" size={18} /></IconButton>
          <input disabled={isSending} maxLength={4000} onChange={(event) => setMessage(event.target.value)} placeholder="พิมพ์ข้อความ..." value={message} />
          <IconButton disabled={(!message.trim() && !attachment) || isSending} label="ส่งข้อความ" type="submit" variant="primary"><Send aria-hidden="true" size={17} /></IconButton>
        </div>
      </form> : null}
    </aside>
    <IconButton className="chat-minimize-button" label="ย่อหน้าต่างแชท" onClick={() => setIsOpen(false)} size="lg" variant="primary"><ChevronDown aria-hidden="true" size={28} /></IconButton>
  </>;
}
