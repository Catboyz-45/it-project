"use client";
// ชิ้นส่วนหน้าจอที่หน้าต่างแชทฝั่งเจ้าของหอและฝั่งผู้ดูแลระบบใช้ร่วมกัน
// สองหน้าต่างนั้นหน้าตาเหมือนกันเกือบทั้งหมด ต่างแค่ชื่อคู่สนทนาและฝั่งของข้อความ

import Image from "next/image";
import { Fragment, type ReactNode, SyntheticEvent, useEffect, useRef } from "react";
import { Expand, FileText, LoaderCircle, MessageSquare, MoreHorizontal, Paperclip, Send, Shrink, X } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { LoadMoreButton } from "@/components/ui/DataNavigation";
import type { ChatThreadMessage } from "@/components/chat/use-chat-thread";
import { chatDayKey, chatDayLabel, chatTime } from "@/lib/chat-time";

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

// ข้อความหนึ่งฟอง ของเราชิดขวาสีม่วง ของอีกฝั่งชิดซ้ายสีเทา
// ชื่อผู้ส่งขึ้นเฉพาะฝั่งตรงข้ามและเฉพาะข้อความแรกของช่วงที่คนเดิมพิมพ์ต่อกัน ไม่ต้องอ่านชื่อซ้ำทุกฟอง
function ChatMessageItem({ isOwn, message, showSender }: Readonly<{ isOwn: boolean; message: ChatThreadMessage; showSender: boolean }>) {
  return <article className={`chat-message ${isOwn ? "is-own" : "is-other"}`}>
    {isOwn ? <span className="sr-only">คุณ</span> : showSender ? <strong>{message.senderName}</strong> : <span className="sr-only">{message.senderName}</span>}
    {message.body ? <p>{message.body}</p> : null}
    <MessageAttachment attachment={message.attachment} />
    <time dateTime={message.createdAt}>{chatTime(message.createdAt)}</time>
  </article>;
}

// หน้าว่างของห้องสนทนา มีปุ่มลัดให้เลือกเรื่องที่จะคุย กดแล้วเติมข้อความในช่องพิมพ์ให้
export function ChatEmptyState({ description, onSuggest, suggestions = [], title }: Readonly<{
  description: string;
  onSuggest?: (text: string) => void;
  suggestions?: string[];
  title: string;
}>) {
  return <div className="chat-empty-state">
    <span aria-hidden="true"><MessageSquare size={22} /></span>
    <strong>{title}</strong>
    <p>{description}</p>
    {onSuggest && suggestions.length ? <div className="chat-suggestions">
      {suggestions.map((text) => <button key={text} onClick={() => onSuggest(text)} type="button">{text}</button>)}
    </div> : null}
  </div>;
}

// พื้นที่ข้อความของห้องสนทนา พร้อมปุ่มโหลดข้อความก่อนหน้าและหมุดสำหรับเลื่อนลงล่างสุด
export function ChatMessageList<T extends ChatThreadMessage>({
  className = "chat-conversation",
  emptyState,
  endRef,
  hasOlderMessages,
  isLoading,
  isLoadingOlder,
  messages,
  onLoadOlder,
  ownRole,
  scrollRef,
}: Readonly<{
  className?: string;
  emptyState: ReactNode;
  endRef: React.RefObject<HTMLDivElement | null>;
  hasOlderMessages: boolean;
  isLoading: boolean;
  isLoadingOlder: boolean;
  messages: T[];
  onLoadOlder: () => void;
  ownRole: ChatThreadMessage["senderRole"];
  scrollRef: React.RefObject<HTMLDivElement | null>;
}>) {
  return <div className={className} ref={scrollRef}>
    {isLoading ? <p className="chat-conversation-prompt"><LoaderCircle aria-hidden="true" className="animate-spin" size={16} /> กำลังโหลดข้อความ...</p> : null}
    {!isLoading && hasOlderMessages ? <LoadMoreButton className="mb-3 border-t-0 p-0" isLoading={isLoadingOlder} label="โหลดข้อความก่อนหน้า" onClick={onLoadOlder} /> : null}
    {!isLoading && messages.length === 0 ? emptyState : null}
    {messages.map((item, index) => {
      const previous = messages[index - 1];
      // ข้อความแรกของแต่ละวันมีป้ายคั่นวัน ดูย้อนหลังแล้วรู้ทันทีว่าคุยกันวันไหน
      const startsDay = !previous || chatDayKey(previous.createdAt) !== chatDayKey(item.createdAt);
      const showSender = startsDay || previous.senderRole !== item.senderRole;
      return <Fragment key={item.id}>
        {startsDay ? <p className="chat-day-divider"><span>{chatDayLabel(item.createdAt)}</span></p> : null}
        <ChatMessageItem isOwn={item.senderRole === ownRole} message={item} showSender={showSender} />
      </Fragment>;
    })}
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
  inputLabel = "ข้อความ",
  inputRef,
  isReady,
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
  inputLabel?: string;
  // ให้คนนอกโฟกัสช่องพิมพ์ได้ เช่นกดปุ่มลัดในหน้าว่างแล้วพิมพ์ต่อได้ทันที
  inputRef?: React.RefObject<HTMLInputElement | null>;
  isReady: boolean;
  isSending: boolean;
  message: string;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  setAttachment: (file: File | null) => void;
  setError: (message: string) => void;
  setMessage: (value: string) => void;
}>) {
  const ownInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = inputRef ?? ownInputRef;
  // เปิดห้องสนทนาแล้วพิมพ์ได้ทันทีไม่ต้องคลิกช่องก่อน เฉพาะเครื่องที่ใช้เมาส์
  // บนมือถือไม่โฟกัสให้ เพราะแป้นพิมพ์จะเด้งขึ้นมาบังข้อความเก่าทั้งที่ผู้ใช้แค่อยากอ่าน
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) messageInputRef.current?.focus();
  }, [messageInputRef]);

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
    {/* ช่องพิมพ์ทรงแคปซูล ปุ่มแนบไฟล์อยู่ในช่อง ปุ่มส่งเป็นวงกลมข้าง ๆ แบบแอปแชททั่วไป */}
    <div className="chat-composer-row">
      <input accept="image/png,image/jpeg,image/webp,application/pdf" className="chat-file-input" onChange={pickFile} ref={fileInputRef} type="file" />
      <div className="chat-composer-field">
        {canAttach ? <IconButton className="chat-attach-button" disabled={isSending || !isReady} label="แนบรูปหรือไฟล์" onClick={() => fileInputRef.current?.click()}><Paperclip aria-hidden="true" size={18} /></IconButton> : null}
        <input aria-label={inputLabel} disabled={isSending} maxLength={4000} onChange={(event) => setMessage(event.target.value)} placeholder="พิมพ์ข้อความ..." ref={messageInputRef} value={message} />
      </div>
      <IconButton className="chat-send-button" disabled={(!message.trim() && !attachment) || isSending || !isReady} label={isSending ? "กำลังส่งข้อความ" : "ส่งข้อความ"} type="submit" variant="primary">
        {isSending ? <LoaderCircle aria-hidden="true" className="animate-spin" size={17} /> : <Send aria-hidden="true" size={17} />}
      </IconButton>
    </div>
  </form>;
}
