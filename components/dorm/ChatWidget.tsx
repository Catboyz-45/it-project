"use client";
// ต่อสตรีมข้อความ จัดการการเลื่อน และอัปโหลดไฟล์จากเบราว์เซอร์

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronLeft, Crown, Expand, FileText, MessageSquare, MoreHorizontal, Paperclip, Pin, Send, Shrink, X } from "lucide-react";
import type { Tenant } from "@/types/dorm";
import { ReadOnlyNotice } from "@/components/dorm/ReadOnlyNotice";
import { LoadMoreButton } from "@/components/ui/DataNavigation";
import { IconButton } from "@/components/ui/IconButton";

// หน้าต่างแชทมีสองหน้า รายชื่อคู่สนทนา กับห้องสนทนา
type ChatView = "tenants" | "chat";
// ข้อความหนึ่งข้อความ ส่งเป็นข้อความอย่างเดียว ไฟล์อย่างเดียว หรือทั้งสองอย่างก็ได้
type ChatMessage = {
  id: string;
  tenantId: string;
  body: string;
  senderRole: "ADMIN" | "TENANT" | "SUPER_ADMIN";
  senderName: string;
  createdAt: string;
  attachment: { name: string; mimeType: string; size: number; url: string } | null;
};
// isSupport แยกแอดมินใหญ่ออกจากผู้เช่า เพราะใช้คนละ API และแสดงผลต่างกัน
type ChatContact = { id: string; isSupport?: boolean; name: string; roomId: string };

// หน้าต่างแชทมุมจอฝั่งเจ้าของหอ คุยกับผู้เช่าและกับแอดมินใหญ่
export function ChatWidget({
  propertyId,
  readOnly = false,
  tenants,
  unreadCount = 0,
  // ตัวเลขที่เพิ่มขึ้นจากหน้าแม่เพื่อสั่งเปิดแชท ใช้ตัวเลขเพราะสั่งเปิดซ้ำได้เรื่อย ๆ
  openSignal = 0,
}: {
  propertyId: string;
  readOnly?: boolean;
  tenants: Tenant[];
  unreadCount?: number;
  openSignal?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [view, setView] = useState<ChatView>("tenants");
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [error, setError] = useState("");
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const conversationScrollRef = useRef<HTMLDivElement>(null);
  // ปกติข้อความใหม่เข้ามาแล้วเลื่อนลงล่างสุด ยกเว้นตอนโหลดข้อความเก่ามาต่อข้างบน
  const shouldScrollToEndRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ข้าม 0 ซึ่งเป็นค่าเริ่มต้น ไม่งั้นแชทจะเด้งเปิดเองตั้งแต่เข้าหน้า
  useEffect(() => {
    if (openSignal <= 0) return;
    setView("tenants");
    setIsOpen(true);
  }, [openSignal]);

  // ปักแอดมินใหญ่ไว้บนสุดเสมอ เพราะเป็นช่องทางขอความช่วยเหลือเรื่องระบบ
  const contacts = useMemo<ChatContact[]>(
    () => [
      { id: "super-admin", isSupport: true, name: "แอดมินใหญ่", roomId: "SUPPORT" },
      ...tenants.map((tenant) => ({ id: tenant.id, name: tenant.name, roomId: tenant.roomId })),
    ],
    [tenants],
  );
  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === selectedTenantId) ?? contacts[0],
    [contacts, selectedTenantId],
  );

  // เช็ค id ซ้ำก่อนต่อท้าย เพราะข้อความที่เราส่งเองจะกลับมาทางสตรีมอีกรอบด้วย
  const appendMessage = (nextMessage: ChatMessage) => {
    setMessages((current) => current.some((item) => item.id === nextMessage.id) ? current : [...current, nextMessage]);
  };

  useEffect(() => {
    if (!isOpen || !conversationId) return;
    // EventSource รับข้อความใหม่จากเซิร์ฟเวอร์ทางเดียว เบากว่าถามซ้ำ ๆ และเบราว์เซอร์ต่อใหม่ให้เองเมื่อหลุด
    // after เป็นเวลาปัจจุบัน เพราะข้อความเก่าโหลดมาแล้วจาก effect ข้างล่าง
    const stream = new EventSource(`/api/v1/chat/conversations/${conversationId}/stream?propertyId=${encodeURIComponent(propertyId)}&after=${encodeURIComponent(new Date().toISOString())}`);
    stream.onmessage = (event) => {
      try {
        const nextMessage = JSON.parse(event.data) as ChatMessage;
        appendMessage(nextMessage);
      } catch {
        setError("รับข้อความใหม่ไม่สำเร็จ");
      }
    };
    stream.onerror = () => setError("การเชื่อมต่อเรียลไทม์ขัดข้อง ระบบกำลังเชื่อมต่อใหม่");
    // ต่อติดแล้วก็ล้างข้อความเตือนทิ้ง ผู้ใช้จะได้รู้ว่ากลับมาปกติแล้ว
    stream.onopen = () => setError("");
    // ต้องปิดสตรีมตอนออกจากหน้า ไม่งั้นการเชื่อมต่อจะค้างสะสม
    return () => stream.close();
  }, [conversationId, isOpen, propertyId]);

  useEffect(() => {
    if (view !== "chat" || !selectedTenantId) return;
    const controller = new AbortController();
    setIsLoading(true);
    setError("");
    // คนละ API เพราะสิทธิ์ต่างกัน คุยกับผู้เช่าต้องเป็นผู้เช่าในหอนี้เท่านั้น
    const endpoint = selectedContact?.isSupport
      ? `/api/v1/admin/properties/${propertyId}/support-chat`
      : `/api/v1/admin/properties/${propertyId}/tenant-chat/${selectedTenantId}`;
    void fetch(endpoint, {
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      const result = await response.json() as { conversationId?: string; error?: string; hasMore?: boolean; messages?: ChatMessage[] };
      if (!response.ok || !result.messages) throw new Error(result.error || "โหลดข้อความไม่สำเร็จ");
      setMessages(result.messages);
      setHasOlderMessages(result.hasMore ?? false);
      setConversationId(result.conversationId ?? null);
    }).catch((loadError) => {
      // ยกเลิกเองตอนเปลี่ยนคู่สนทนา ไม่ใช่ข้อผิดพลาดจริง
      if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "โหลดข้อความไม่สำเร็จ");
    }).finally(() => {
      if (!controller.signal.aborted) setIsLoading(false);
    });
    return () => controller.abort();
  }, [propertyId, selectedContact?.isSupport, selectedTenantId, view]);

  // เลื่อนลงล่างสุดเมื่อมีข้อความใหม่ แล้วรีเซ็ตธงกลับเป็นค่าปกติทันที
  useEffect(() => {
    if (shouldScrollToEndRef.current) conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
    shouldScrollToEndRef.current = true;
  }, [messages]);

  const loadOlderMessages = async () => {
    const oldest = messages[0];
    if (!oldest || !selectedContact || isLoadingOlder) return;
    setIsLoadingOlder(true);
    setError("");
    // จำความสูงเดิมไว้ก่อน เดี๋ยวใช้คำนวณชดเชยการเลื่อนหลังข้อความเก่าถูกแทรกเข้ามา
    const container = conversationScrollRef.current;
    const previousHeight = container?.scrollHeight ?? 0;
    try {
      const endpoint = selectedContact.isSupport
        ? `/api/v1/admin/properties/${propertyId}/support-chat`
        : `/api/v1/admin/properties/${propertyId}/tenant-chat/${selectedContact.id}`;
      // อ้างอิงจาก id ของข้อความเก่าสุดที่มีอยู่ ไม่ใช้เลขหน้า เพราะข้อความใหม่เข้ามาแล้วเลขหน้าจะเลื่อน
      const search = new URLSearchParams({ beforeMessageId: oldest.id, limit: "50" });
      const response = await fetch(`${endpoint}?${search}`, { cache: "no-store" });
      const result = await response.json() as { error?: string; hasMore?: boolean; messages?: ChatMessage[] };
      if (!response.ok || !result.messages) throw new Error(result.error || "โหลดข้อความก่อนหน้าไม่สำเร็จ");
      const olderMessages = result.messages;
      // ครั้งนี้อย่าเลื่อนลงล่าง ผู้ใช้กำลังอ่านข้อความเก่าอยู่
      shouldScrollToEndRef.current = false;
      setMessages((current) => [
        ...olderMessages.filter((item) => !current.some((existing) => existing.id === item.id)),
        ...current,
      ]);
      setHasOlderMessages(result.hasMore ?? false);
      // ดันตำแหน่งลงเท่ากับความสูงที่เพิ่มมา ข้อความที่อ่านอยู่จะได้ค้างที่เดิมไม่กระโดด
      requestAnimationFrame(() => {
        if (container) container.scrollTop += container.scrollHeight - previousHeight;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดข้อความก่อนหน้าไม่สำเร็จ");
    } finally {
      setIsLoadingOlder(false);
    }
  };

  const openTenantChat = (tenantId: string) => {
    setSelectedTenantId(tenantId);
    setView("chat");
    setIsOptionsOpen(false);
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    // กันเบราว์เซอร์รีเฟรชหน้าตามพฤติกรรมฟอร์มปกติ
    event.preventDefault();
    const body = message.trim();
    // ส่งได้ถ้ามีข้อความหรือมีไฟล์อย่างใดอย่างหนึ่ง และต้องไม่กำลังส่งอยู่
    if ((!body && !attachment) || !selectedContact || isSending) return;
    setIsSending(true);
    setError("");
    try {
      // id ที่ฝั่งเราสร้าง ให้เซิร์ฟเวอร์ใช้กันบันทึกซ้ำถ้าคำขอถูกส่งซ้ำ
      const clientId = crypto.randomUUID();
      if (!conversationId) throw new Error("ยังไม่พบบทสนทนา");
      const baseEndpoint = selectedContact.isSupport
        ? `/api/v1/admin/properties/${propertyId}/support-chat`
        : `/api/v1/admin/properties/${propertyId}/tenant-chat/${selectedContact.id}`;
      // มีไฟล์ต้องส่งเป็น FormData ไปที่ปลายทางของไฟล์ ไม่มีไฟล์ก็ส่ง JSON ตามปกติ
      const response = attachment
        ? await fetch(`/api/v1/chat/conversations/${conversationId}/attachments`, {
          method: "POST",
          headers: { "x-property-id": propertyId },
          body: (() => {
            const formData = new FormData();
            formData.set("propertyId", propertyId);
            formData.set("body", body);
            formData.set("clientId", clientId);
            formData.set("file", attachment);
            return formData;
          })(),
        })
        : await fetch(baseEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
          body,
          clientId,
        }),
      });
      const result = await response.json() as { error?: string; message?: ChatMessage };
      if (!response.ok || !result.message) throw new Error(result.error || "ส่งข้อความไม่สำเร็จ");
      // ต่อข้อความที่เซิร์ฟเวอร์ตอบกลับมา ไม่ใช่ที่พิมพ์ไว้ จะได้ได้ id กับเวลาที่ถูกต้อง
      appendMessage(result.message);
      // ล้างช่องพิมพ์เมื่อส่งสำเร็จเท่านั้น ส่งไม่ผ่านข้อความจะได้ยังอยู่ให้กดส่งใหม่
      setMessage("");
      setAttachment(null);
      // ล้างค่า input ด้วย ไม่งั้นเลือกไฟล์ชื่อเดิมซ้ำจะไม่เกิด onChange
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "ส่งข้อความไม่สำเร็จ");
    } finally {
      setIsSending(false);
    }
  };

  // ปิดอยู่ก็เหลือแค่ปุ่มลอยมุมจอ พร้อมป้ายจำนวนข้อความที่ยังไม่ได้อ่าน
  if (!isOpen) {
    return <IconButton className="chat-launcher" label="เปิดข้อความผู้เช่า" onClick={() => {
      setView("tenants");
      setIsOpen(true);
    }} size="lg" variant="primary">
      <MessageSquare size={24} />
      {unreadCount > 0 ? (
        <span className="chat-notification-badge" aria-label={`${unreadCount} ข้อความที่ยังไม่ได้อ่าน`}>
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </IconButton>;
  }

  return <>
    <aside className={`${view === "chat" ? "chat-widget chat-mode" : "chat-widget"}${isExpanded ? " expanded" : ""}`} aria-label="ข้อความผู้เช่า">
      {/* หัวหน้าต่างคนละแบบ ในห้องสนทนามีปุ่มย้อนกลับกับชื่อคู่สนทนา */}
      {view === "chat" && selectedContact ? (
        <header className="chat-widget-header chat-conversation-header">
          <IconButton label="ย้อนกลับไปยังรายชื่อผู้เช่า" onClick={() => { setIsOptionsOpen(false); setView("tenants"); }}><ChevronLeft size={22} /></IconButton>
          <div className="chat-conversation-brand">
            <span className={`chat-person-avatar muted${selectedContact.isSupport ? " support" : ""}`}>{selectedContact.isSupport ? <Crown size={19} /> : selectedContact.roomId}</span>
            <strong>{selectedContact.isSupport ? "แอดมินใหญ่" : `ห้อง ${selectedContact.roomId}`}</strong>
          </div>
          <div className="chat-header-actions">
            <div className="chat-options">
              <IconButton label="ตัวเลือกหน้าต่างแชท" onClick={() => setIsOptionsOpen((current) => !current)}><MoreHorizontal size={22} /></IconButton>
              {isOptionsOpen ? <div className="chat-options-menu"><button onClick={() => {
                setIsExpanded((current) => !current);
                setIsOptionsOpen(false);
              }} type="button">{isExpanded ? <Shrink size={18} /> : <Expand size={18} />}{isExpanded ? "ย่อหน้าต่าง" : "ขยายหน้าต่าง"}</button></div> : null}
            </div>
            <IconButton label="ปิดหน้าต่างข้อความ" onClick={() => setIsOpen(false)}><X size={22} /></IconButton>
          </div>
        </header>
      ) : (
        <header className="chat-widget-header">
          <IconButton label="ย้อนกลับ" onClick={() => { setIsOptionsOpen(false); setIsOpen(false); }}><ChevronLeft size={22} /></IconButton>
          <div className="chat-widget-brand"><strong>ข้อความ</strong></div>
          <IconButton label="ปิดหน้าต่างข้อความ" onClick={() => { setIsOptionsOpen(false); setIsOpen(false); }}><X size={22} /></IconButton>
        </header>
      )}

      <div className="chat-widget-body">
        {view === "tenants" ? <div className="chat-tenant-list">
          {contacts.map((contact) => <button className={contact.isSupport ? "chat-support-contact" : ""} key={contact.id} onClick={() => openTenantChat(contact.id)} type="button">
            <span className={`chat-list-avatar${contact.isSupport ? " support" : ""}`}>{contact.isSupport ? <Crown size={20} /> : contact.roomId}</span>
            <span><strong>{contact.isSupport ? "แอดมินใหญ่" : `ห้อง ${contact.roomId}`}</strong><small>{contact.isSupport ? "สอบถามปัญหาการใช้งานระบบ" : contact.name}</small></span>
            {contact.isSupport ? <Pin className="chat-pinned-icon" size={16} /> : null}
          </button>)}
        </div> : null}

        {view === "chat" && selectedContact ? <div className="chat-conversation" ref={conversationScrollRef}>
          {isLoading ? <p className="chat-conversation-prompt">กำลังโหลดข้อความ...</p> : null}
          {!isLoading && hasOlderMessages ? <LoadMoreButton className="mb-3 border-t-0 p-0" isLoading={isLoadingOlder} label="โหลดข้อความก่อนหน้า" onClick={() => void loadOlderMessages()} /> : null}
          {!isLoading && messages.length === 0 ? <p className="chat-conversation-prompt">{selectedContact.isSupport ? "ยังไม่มีข้อความ เริ่มสนทนากับแอดมินใหญ่" : `ยังไม่มีข้อความ เริ่มสนทนากับผู้เช่าห้อง ${selectedContact.roomId}`}</p> : null}
          {messages.map((item) => <article className={`chat-message ${item.senderRole === "ADMIN" ? "from-admin" : "from-tenant"}`} key={item.id}>
            <strong>{item.senderName}</strong>
            {item.body ? <p>{item.body}</p> : null}
            {item.attachment ? item.attachment.mimeType.startsWith("image/") ? (
              <a className="chat-image-attachment" href={item.attachment.url} rel="noreferrer" target="_blank">
                <Image alt={item.attachment.name} height={240} src={item.attachment.url} unoptimized width={320} />
              </a>
            ) : (
              <a className="chat-file-attachment" href={item.attachment.url} rel="noreferrer" target="_blank">
                <FileText size={22} /><span><strong>{item.attachment.name}</strong><small>{(item.attachment.size / 1024).toFixed(1)} KB</small></span>
              </a>
            ) : null}
            <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</time>
          </article>)}
          {/* กล่องเปล่าไว้เป็นหมุดให้เลื่อนไปหา ง่ายกว่าคำนวณความสูงเอง */}
          <div ref={conversationEndRef} />
        </div> : null}
      </div>

      {/* โหมดอ่านอย่างเดียวยังคุยกับแอดมินใหญ่ได้ เพราะต้องใช้ติดต่อขอต่ออายุแพ็กเกจ */}
      {view === "chat" && (!readOnly || selectedContact?.isSupport) ? <form className="chat-composer" onSubmit={sendMessage}>
        {error ? <p className="chat-error" role="alert">{error}</p> : null}
        {attachment ? <div className="chat-attachment-preview"><FileText size={18} /><span>{attachment.name}</span><IconButton label="นำไฟล์แนบออก" onClick={() => { setAttachment(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} size="sm"><X size={16} /></IconButton></div> : null}
        <div>
          <input accept="image/png,image/jpeg,image/webp,application/pdf" className="chat-file-input" onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            // ตรวจขนาดตั้งแต่ตอนเลือก จะได้ไม่เสียเวลาอัปโหลดแล้วโดนปฏิเสธ ส่วนเซิร์ฟเวอร์ตรวจซ้ำอยู่ดี
            if (file && file.size > 5 * 1024 * 1024) {
              setError("ไฟล์ต้องมีขนาดไม่เกิน 5 MB");
              event.target.value = "";
              return;
            }
            setError("");
            setAttachment(file);
          }} ref={fileInputRef} type="file" />
          {!readOnly ? <IconButton className="chat-attach-button" disabled={isSending} label="แนบรูปหรือไฟล์" onClick={() => fileInputRef.current?.click()}><Paperclip size={18} /></IconButton> : null}
          <input disabled={isSending} maxLength={4000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="พิมพ์ข้อความ..." />
          <IconButton disabled={(!message.trim() && !attachment) || isSending} label="ส่งข้อความ" type="submit" variant="primary"><Send size={17} /></IconButton>
        </div>
      </form> : view === "chat" && readOnly ? <ReadOnlyNotice className="m-3">อ่านประวัติข้อความผู้เช่าได้ แต่ไม่สามารถส่งข้อความหรือไฟล์ใหม่ได้</ReadOnlyNotice> : null}
    </aside>
    <IconButton className="chat-minimize-button" label="ย่อหน้าต่างแชท" onClick={() => { setIsOptionsOpen(false); setIsOpen(false); }} size="lg" variant="primary"><ChevronDown size={28} /></IconButton>
  </>;
}
