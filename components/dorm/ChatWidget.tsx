"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Chat Widget” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronLeft, Crown, Expand, FileText, MessageSquare, MoreHorizontal, Paperclip, Pin, Send, Shrink, X } from "lucide-react";
import type { Tenant } from "@/types/dorm";
import { ReadOnlyNotice } from "@/components/dorm/ReadOnlyNotice";
import { LoadMoreButton } from "@/components/ui/DataNavigation";
import { IconButton } from "@/components/ui/IconButton";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Chat View” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type ChatView = "tenants" | "chat";
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Chat Message” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type ChatMessage = {
  id: string;
  tenantId: string;
  body: string;
  senderRole: "ADMIN" | "TENANT" | "SUPER_ADMIN";
  senderName: string;
  createdAt: string;
  attachment: { name: string; mimeType: string; size: number; url: string } | null;
};
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Chat Contact” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type ChatContact = { id: string; isSupport?: boolean; name: string; roomId: string };

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Chat Widget” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { propertyId, readOnly = false, tenants, unreadCount = 0, op: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function ChatWidget({
  propertyId,
  readOnly = false,
  tenants,
  unreadCount = 0,
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
  const shouldScrollToEndRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (openSignal <= 0) return;
    setView("tenants");
    setIsOpen(true);
  }, [openSignal]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “contacts” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const contacts = useMemo<ChatContact[]>(
    () => [
      { id: "super-admin", isSupport: true, name: "แอดมินใหญ่", roomId: "SUPPORT" },
      ...tenants.map((tenant) => ({ id: tenant.id, name: tenant.name, roomId: tenant.roomId })),
    ],
    [tenants],
  );
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “selected Contact” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === selectedTenantId) ?? contacts[0],
    [contacts, selectedTenantId],
  );

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “append Message” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - nextMessage: ค่า “next Message” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const appendMessage = (nextMessage: ChatMessage) => {
    setMessages((current) => current.some((item) => item.id === nextMessage.id) ? current : [...current, nextMessage]);
  };

  useEffect(() => {
    if (!isOpen || !conversationId) return;
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
    stream.onopen = () => setError("");
    return () => stream.close();
  }, [conversationId, isOpen, propertyId]);

  useEffect(() => {
    if (view !== "chat" || !selectedTenantId) return;
    const controller = new AbortController();
    setIsLoading(true);
    setError("");
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
      if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "โหลดข้อความไม่สำเร็จ");
    }).finally(() => {
      if (!controller.signal.aborted) setIsLoading(false);
    });
    return () => controller.abort();
  }, [propertyId, selectedContact?.isSupport, selectedTenantId, view]);

  useEffect(() => {
    if (shouldScrollToEndRef.current) conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
    if (!oldest || !selectedContact || isLoadingOlder) return;
    setIsLoadingOlder(true);
    setError("");
    const container = conversationScrollRef.current;
    const previousHeight = container?.scrollHeight ?? 0;
    try {
      const endpoint = selectedContact.isSupport
        ? `/api/v1/admin/properties/${propertyId}/support-chat`
        : `/api/v1/admin/properties/${propertyId}/tenant-chat/${selectedContact.id}`;
      const search = new URLSearchParams({ beforeMessageId: oldest.id, limit: "50" });
      const response = await fetch(`${endpoint}?${search}`, { cache: "no-store" });
      const result = await response.json() as { error?: string; hasMore?: boolean; messages?: ChatMessage[] };
      if (!response.ok || !result.messages) throw new Error(result.error || "โหลดข้อความก่อนหน้าไม่สำเร็จ");
      const olderMessages = result.messages;
      shouldScrollToEndRef.current = false;
      setMessages((current) => [
        ...olderMessages.filter((item) => !current.some((existing) => existing.id === item.id)),
        ...current,
      ]);
      setHasOlderMessages(result.hasMore ?? false);
      requestAnimationFrame(() => {
        if (container) container.scrollTop += container.scrollHeight - previousHeight;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดข้อความก่อนหน้าไม่สำเร็จ");
    } finally {
      setIsLoadingOlder(false);
    }
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “open Tenant Chat” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - tenantId: รหัสภายในของ tenant
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const openTenantChat = (tenantId: string) => {
    setSelectedTenantId(tenantId);
    setView("chat");
    setIsOptionsOpen(false);
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
    if ((!body && !attachment) || !selectedContact || isSending) return;
    setIsSending(true);
    setError("");
    try {
      const clientId = crypto.randomUUID();
      if (!conversationId) throw new Error("ยังไม่พบบทสนทนา");
      const baseEndpoint = selectedContact.isSupport
        ? `/api/v1/admin/properties/${propertyId}/support-chat`
        : `/api/v1/admin/properties/${propertyId}/tenant-chat/${selectedContact.id}`;
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
      appendMessage(result.message);
      setMessage("");
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "ส่งข้อความไม่สำเร็จ");
    } finally {
      setIsSending(false);
    }
  };

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
          <div ref={conversationEndRef} />
        </div> : null}
      </div>

      {view === "chat" && (!readOnly || selectedContact?.isSupport) ? <form className="chat-composer" onSubmit={sendMessage}>
        {error ? <p className="chat-error" role="alert">{error}</p> : null}
        {attachment ? <div className="chat-attachment-preview"><FileText size={18} /><span>{attachment.name}</span><IconButton label="นำไฟล์แนบออก" onClick={() => { setAttachment(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} size="sm"><X size={16} /></IconButton></div> : null}
        <div>
          <input accept="image/png,image/jpeg,image/webp,application/pdf" className="chat-file-input" onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
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
