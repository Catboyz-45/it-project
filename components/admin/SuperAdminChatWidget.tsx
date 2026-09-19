"use client";
// เก็บสถานะการสนทนา จัดการการเลื่อน และอัปโหลดไฟล์จากเบราว์เซอร์

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

// หนึ่งห้องสนทนา ผู้ดูแลระบบคุยกับเจ้าของหอแต่ละหอคนละห้อง
type SupportConversation = {
  id: string;
  propertyId: string;
  propertyName: string;
  lastMessageAt: string | null;
  unreadCount: number;
};

// ข้อความหนึ่งข้อความ ส่งเป็นข้อความอย่างเดียว ไฟล์อย่างเดียว หรือทั้งสองอย่างก็ได้
type SupportMessage = {
  id: string;
  body: string;
  senderRole: "ADMIN" | "TENANT" | "SUPER_ADMIN";
  senderName: string;
  createdAt: string;
  attachment: { name: string; mimeType: string; size: number; url: string } | null;
};

// หน้าต่างแชทมุมจอของผู้ดูแลระบบ รับเรื่องช่วยเหลือจากเจ้าของหอทุกหอ
// ทำงานคล้าย ChatWidget ฝั่งเจ้าของหอ ต่างที่ไม่มีสตรีมเรียลไทม์ เพราะไม่ต้องเร่งเท่า
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
  // ปกติข้อความใหม่เข้ามาแล้วเลื่อนลงล่างสุด ยกเว้นตอนโหลดข้อความเก่ามาต่อข้างบน
  const shouldScrollToEndRef = useRef(true);

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
      // กรอง id ซ้ำก่อนต่อท้าย เผื่อมีห้องใหม่แทรกเข้ามาแล้วทำให้หน้าที่แบ่งไว้เลื่อน
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

  // โหลดข้อความเก่ากว่ามาต่อข้างบน พร้อมชดเชยการเลื่อนไม่ให้หน้ากระโดด
  const loadOlderMessages = async () => {
    const oldest = messages[0];
    if (!selected || !oldest || isLoadingOlder) return;
    setIsLoadingOlder(true); setError("");
    // จำความสูงเดิมไว้ก่อน เดี๋ยวใช้คำนวณชดเชยการเลื่อนหลังข้อความเก่าถูกแทรกเข้ามา
    const container = scrollRef.current;
    const previousHeight = container?.scrollHeight ?? 0;
    try {
      // อ้างอิงจาก id ของข้อความเก่าสุดที่มีอยู่ ไม่ใช้เลขหน้า เพราะข้อความใหม่เข้ามาแล้วเลขหน้าจะเลื่อน
      const search = new URLSearchParams({ beforeMessageId: oldest.id, limit: "50" });
      const response = await fetch(`/api/v1/super-admin/properties/${selected.propertyId}/support-chat?${search}`, { cache: "no-store" });
      const result = await response.json() as { error?: string; hasMore?: boolean; messages?: SupportMessage[] };
      if (!response.ok || !result.messages) throw new Error(result.error || "โหลดข้อความก่อนหน้าไม่สำเร็จ");
      // ครั้งนี้อย่าเลื่อนลงล่าง ผู้ใช้กำลังอ่านข้อความเก่าอยู่
      shouldScrollToEndRef.current = false;
      setMessages((current) => [...result.messages!.filter((item) => !current.some((existing) => existing.id === item.id)), ...current]);
      setHasOlderMessages(result.hasMore ?? false);
      // ดันตำแหน่งลงเท่ากับความสูงที่เพิ่มมา ข้อความที่อ่านอยู่จะได้ค้างที่เดิมไม่กระโดด
      requestAnimationFrame(() => {
        if (container) container.scrollTop += container.scrollHeight - previousHeight;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดข้อความก่อนหน้าไม่สำเร็จ");
    } finally { setIsLoadingOlder(false); }
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    // กันเบราว์เซอร์รีเฟรชหน้าตามพฤติกรรมฟอร์มปกติ
    event.preventDefault();
    const body = message.trim();
    // ส่งได้ถ้ามีข้อความหรือมีไฟล์อย่างใดอย่างหนึ่ง และต้องไม่กำลังส่งอยู่
    if ((!body && !attachment) || !selected || !conversationId || isSending) return;
    setIsSending(true); setError("");
    try {
      // id ที่ฝั่งเราสร้าง ให้เซิร์ฟเวอร์ใช้กันบันทึกซ้ำถ้าคำขอถูกส่งซ้ำ
      const clientId = crypto.randomUUID();
      // มีไฟล์ต้องส่งเป็น FormData ไปที่ปลายทางของไฟล์ ไม่มีไฟล์ก็ส่ง JSON ตามปกติ
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
      // เช็ค id ซ้ำก่อนต่อท้าย และใช้ข้อความที่เซิร์ฟเวอร์ตอบกลับมา จะได้ได้ id กับเวลาที่ถูกต้อง
      setMessages((current) => current.some((item) => item.id === result.message!.id) ? current : [...current, result.message!]);
      // ล้างช่องพิมพ์เมื่อส่งสำเร็จเท่านั้น ส่งไม่ผ่านข้อความจะได้ยังอยู่ให้กดส่งใหม่
      setMessage("");
      setAttachment(null);
      // ล้างค่า input ด้วย ไม่งั้นเลือกไฟล์ชื่อเดิมซ้ำจะไม่เกิด onChange
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "ส่งข้อความไม่สำเร็จ");
    } finally { setIsSending(false); }
  };

  // รวมยอดที่ยังไม่ได้อ่านจากทุกหอ ไว้แสดงเป็นป้ายบนปุ่มลอยมุมจอ
  const unreadCount = conversations.reduce((sum, item) => sum + item.unreadCount, 0);

  // ปิดอยู่ก็เหลือแค่ปุ่มลอยมุมจอ พร้อมป้ายจำนวนข้อความที่ยังไม่ได้อ่าน
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
