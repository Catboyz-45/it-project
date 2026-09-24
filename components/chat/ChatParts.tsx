"use client";
// ชิ้นส่วนหน้าจอที่หน้าต่างแชทฝั่งเจ้าของหอและฝั่งผู้ดูแลระบบใช้ร่วมกัน
// สองหน้าต่างนั้นหน้าตาเหมือนกันเกือบทั้งหมด ต่างแค่ชื่อคู่สนทนาและฝั่งของข้อความ

import Image from "next/image";
import { SyntheticEvent } from "react";
import { Expand, FileText, MessageSquare, MoreHorizontal, Paperclip, Send, Shrink, X } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { LoadMoreButton } from "@/components/ui/DataNavigation";
import type { ChatThreadMessage } from "@/components/chat/use-chat-thread";

// ไฟล์แนบต้องไม่เกิน 5 MB เซิร์ฟเวอร์ตรวจซ้ำอยู่แล้ว ตรงนี้แค่บอกผู้ใช้ให้เร็วขึ้น
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

// ป้ายจำนวนที่ยังไม่ได้อ่าน ซ่อนไปเลยเมื่อไม่มีอะไรค้าง
export function UnreadBadge({ className, count }: Readonly<{ className: string; count: number }>) {
  if (count <= 0) return null;
  return <span aria-label={`${count} ข้อความที่ยังไม่ได้อ่าน`} className={className}>{count > 99 ? "99+" : count}</span>;
}

// ปุ่มลอยมุมจอตอนหน้าต่างแชทปิดอยู่
export function ChatLauncher({ label, onClick, unreadCount }: Readonly<{ label: string; onClick: () => void; unreadCount: number }>) {
  return <IconButton className="chat-launcher" label={label} onClick={onClick} size="lg" variant="primary">
    <MessageSquare aria-hidden="true" size={24} />
    <UnreadBadge className="chat-notification-badge" count={unreadCount} />
  </IconButton>;
}

// เมนูย่อขยายหน้าต่าง อยู่มุมขวาบนของหัวหน้าต่าง
export function WindowOptionsMenu({ isExpanded, isMenuOpen, onToggleExpanded, onToggleMenu }: Readonly<{
  isExpanded: boolean;
  isMenuOpen: boolean;
  onToggleExpanded: () => void;
  onToggleMenu: () => void;
}>) {
  return <div className="chat-options">
    <IconButton aria-expanded={isMenuOpen} label="ตัวเลือกหน้าต่างแชท" onClick={onToggleMenu}><MoreHorizontal aria-hidden="true" size={22} /></IconButton>
    {isMenuOpen ? <div className="chat-options-menu">
      <button onClick={onToggleExpanded} type="button">
        {isExpanded ? <Shrink aria-hidden="true" size={18} /> : <Expand aria-hidden="true" size={18} />}{isExpanded ? "ย่อหน้าต่าง" : "ขยายหน้าต่าง"}
      </button>
    </div> : null}
  </div>;
}

// ไฟล์แนบในข้อความ รูปแสดงเป็นภาพตัวอย่าง ไฟล์อื่นแสดงเป็นลิงก์พร้อมขนาด
function MessageAttachment({ attachment }: Readonly<{ attachment: ChatThreadMessage["attachment"] }>) {
  if (!attachment) return null;
  if (attachment.mimeType.startsWith("image/")) {
    return <a className="chat-image-attachment" href={attachment.url} rel="noreferrer" target="_blank">
      <Image alt={attachment.name} height={240} src={attachment.url} unoptimized width={320} />
    </a>;
  }
  return <a className="chat-file-attachment" href={attachment.url} rel="noreferrer" target="_blank">
    <FileText aria-hidden="true" size={22} />
    <span><strong>{attachment.name}</strong><small>{(attachment.size / 1024).toFixed(1)} KB</small></span>
  </a>;
}

// ข้อความหนึ่งฟอง ฝั่งซ้ายหรือขวาขึ้นกับว่าใครเป็นคนส่ง
function ChatMessageItem({ isOwn, message }: Readonly<{ isOwn: boolean; message: ChatThreadMessage }>) {
  return <article className={`chat-message ${isOwn ? "from-admin" : "from-tenant"}`}>
    <strong>{message.senderName}</strong>
    {message.body ? <p>{message.body}</p> : null}
    <MessageAttachment attachment={message.attachment} />
    <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</time>
  </article>;
}

// พื้นที่ข้อความของห้องสนทนา พร้อมปุ่มโหลดข้อความก่อนหน้าและหมุดสำหรับเลื่อนลงล่างสุด
export function ChatMessageList<T extends ChatThreadMessage>({
  emptyText,
  endRef,
  hasOlderMessages,
  isLoading,
  isLoadingOlder,
  messages,
  onLoadOlder,
  ownRole,
  scrollRef,
}: Readonly<{
  emptyText: string;
  endRef: React.RefObject<HTMLDivElement | null>;
  hasOlderMessages: boolean;
  isLoading: boolean;
  isLoadingOlder: boolean;
  messages: T[];
  onLoadOlder: () => void;
  ownRole: ChatThreadMessage["senderRole"];
  scrollRef: React.RefObject<HTMLDivElement | null>;
}>) {
  return <div className="chat-conversation" ref={scrollRef}>
    {isLoading ? <p className="chat-conversation-prompt">กำลังโหลดข้อความ...</p> : null}
    {!isLoading && hasOlderMessages ? <LoadMoreButton className="mb-3 border-t-0 p-0" isLoading={isLoadingOlder} label="โหลดข้อความก่อนหน้า" onClick={onLoadOlder} /> : null}
    {!isLoading && messages.length === 0 ? <p className="chat-conversation-prompt">{emptyText}</p> : null}
    {messages.map((item) => <ChatMessageItem isOwn={item.senderRole === ownRole} key={item.id} message={item} />)}
    {/* กล่องเปล่าไว้เป็นหมุดให้เลื่อนไปหา ง่ายกว่าคำนวณความสูงเอง */}
    <div ref={endRef} />
  </div>;
}

// ช่องพิมพ์ข้อความพร้อมปุ่มแนบไฟล์
export function ChatComposer({
  attachment,
  canAttach = true,
  error,
  fileInputRef,
  isSending,
  message,
  onSubmit,
  setAttachment,
  setError,
  setMessage,
}: Readonly<{
  attachment: File | null;
  canAttach?: boolean;
  error: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isSending: boolean;
  message: string;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  setAttachment: (file: File | null) => void;
  setError: (message: string) => void;
  setMessage: (value: string) => void;
}>) {
  const clearAttachment = () => {
    setAttachment(null);
    // ล้างค่า input ด้วย ไม่งั้นเลือกไฟล์ชื่อเดิมซ้ำจะไม่เกิด onChange
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ตรวจขนาดตั้งแต่ตอนเลือก จะได้ไม่เสียเวลาอัปโหลดแล้วโดนปฏิเสธ ส่วนเซิร์ฟเวอร์ตรวจซ้ำอยู่ดี
  const pickFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (file && file.size > MAX_ATTACHMENT_BYTES) {
      setError("ไฟล์ต้องมีขนาดไม่เกิน 5 MB");
      event.target.value = "";
      return;
    }
    setError("");
    setAttachment(file);
  };

  return <form className="chat-composer" onSubmit={onSubmit}>
    {error ? <p className="chat-error" role="alert">{error}</p> : null}
    {attachment ? <div className="chat-attachment-preview">
      <FileText aria-hidden="true" size={18} />
      <span>{attachment.name}</span>
      <IconButton label="นำไฟล์แนบออก" onClick={clearAttachment} size="sm"><X aria-hidden="true" size={16} /></IconButton>
    </div> : null}
    <div>
      <input accept="image/png,image/jpeg,image/webp,application/pdf" className="chat-file-input" onChange={pickFile} ref={fileInputRef} type="file" />
      {canAttach ? <IconButton className="chat-attach-button" disabled={isSending} label="แนบรูปหรือไฟล์" onClick={() => fileInputRef.current?.click()}><Paperclip aria-hidden="true" size={18} /></IconButton> : null}
      <input disabled={isSending} maxLength={4000} onChange={(event) => setMessage(event.target.value)} placeholder="พิมพ์ข้อความ..." value={message} />
      <IconButton disabled={(!message.trim() && !attachment) || isSending} label="ส่งข้อความ" type="submit" variant="primary"><Send aria-hidden="true" size={17} /></IconButton>
    </div>
  </form>;
}
