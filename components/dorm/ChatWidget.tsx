"use client";
// ต่อสตรีมข้อความ จัดการการเลื่อน และอัปโหลดไฟล์จากเบราว์เซอร์

import { SyntheticEvent, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, Crown, Pin, X } from "lucide-react";
import type { Tenant } from "@/types/dorm";
import { ReadOnlyNotice } from "@/components/dorm/ReadOnlyNotice";
import { useChatThread } from "@/components/chat/use-chat-thread";
import { ChatComposer, ChatLauncher, ChatMessageList, WindowOptionsMenu } from "@/components/chat/ChatParts";
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

// คนละ API เพราะสิทธิ์ต่างกัน คุยกับแอดมินใหญ่เป็นช่องทางช่วยเหลือของหอ
// ส่วนคุยกับผู้เช่าต้องเป็นผู้เช่าในหอนี้เท่านั้น
function contactEndpoint(propertyId: string, contactId: string, isSupport?: boolean) {
  return isSupport
    ? `/api/v1/admin/properties/${propertyId}/support-chat`
    : `/api/v1/admin/properties/${propertyId}/tenant-chat/${contactId}`;
}

// หน้าต่างแชทมุมจอฝั่งเจ้าของหอ คุยกับผู้เช่าและกับแอดมินใหญ่
export function ChatWidget({
  propertyId,
  readOnly = false,
  tenants,
  unreadCount = 0,
  // ตัวเลขที่เพิ่มขึ้นจากหน้าแม่เพื่อสั่งเปิดแชท ใช้ตัวเลขเพราะสั่งเปิดซ้ำได้เรื่อย ๆ
  openSignal = 0,
}: Readonly<{
  propertyId: string;
  readOnly?: boolean;
  tenants: Tenant[];
  unreadCount?: number;
  openSignal?: number;
}>) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [view, setView] = useState<ChatView>("tenants");
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
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

  // null แปลว่ายังอยู่หน้ารายชื่อ ยังไม่ต้องโหลดข้อความ
  const endpoint = view === "chat" && selectedTenantId
    ? contactEndpoint(propertyId, selectedTenantId, selectedContact?.isSupport)
    : null;

  const {
    attachment, endRef, error, fileInputRef, hasOlderMessages, isLoading, isLoadingOlder,
    isSending, loadOlderMessages, message, messages, scrollRef, sendMessage,
    setAttachment, setError, setMessage,
  } = useChatThread<ChatMessage>({ endpoint, propertyId, streaming: isOpen });

  const openTenantChat = (tenantId: string) => {
    setSelectedTenantId(tenantId);
    setView("chat");
    setIsOptionsOpen(false);
  };

  // ปิดอยู่ก็เหลือแค่ปุ่มลอยมุมจอ พร้อมป้ายจำนวนข้อความที่ยังไม่ได้อ่าน
  if (!isOpen) {
    return <ChatLauncher label="เปิดข้อความผู้เช่า" onClick={() => { setView("tenants"); setIsOpen(true); }} unreadCount={unreadCount} />;
  }

  return <>
    <aside className={`${view === "chat" ? "chat-widget chat-mode" : "chat-widget"}${isExpanded ? " expanded" : ""}`} aria-label="ข้อความผู้เช่า">
      <ChatWidgetHeader
        contact={view === "chat" ? selectedContact : undefined}
        isExpanded={isExpanded}
        isMenuOpen={isOptionsOpen}
        onBackToList={() => { setIsOptionsOpen(false); setView("tenants"); }}
        onClose={() => { setIsOptionsOpen(false); setIsOpen(false); }}
        onToggleExpanded={() => { setIsExpanded((current) => !current); setIsOptionsOpen(false); }}
        onToggleMenu={() => setIsOptionsOpen((current) => !current)}
      />

      <div className="chat-widget-body">
        {view === "tenants" ? <ContactList contacts={contacts} onOpen={openTenantChat} /> : null}

        {view === "chat" && selectedContact ? <ChatMessageList
          emptyText={emptyConversationText(selectedContact)}
          endRef={endRef}
          hasOlderMessages={hasOlderMessages}
          isLoading={isLoading}
          isLoadingOlder={isLoadingOlder}
          messages={messages}
          onLoadOlder={() => void loadOlderMessages()}
          ownRole="ADMIN"
          scrollRef={scrollRef}
        /> : null}
      </div>

      {/* โหมดอ่านอย่างเดียวยังคุยกับแอดมินใหญ่ได้ เพราะต้องใช้ติดต่อขอต่ออายุแพ็กเกจ */}
      <ChatFooter
        attachment={attachment}
        canSend={!readOnly || Boolean(selectedContact?.isSupport)}
        error={error}
        fileInputRef={fileInputRef}
        isSending={isSending}
        message={message}
        onSubmit={sendMessage}
        setAttachment={setAttachment}
        setError={setError}
        setMessage={setMessage}
        show={view === "chat"}
        showReadOnlyNotice={readOnly}
      />
    </aside>
    <IconButton className="chat-minimize-button" label="ย่อหน้าต่างแชท" onClick={() => { setIsOptionsOpen(false); setIsOpen(false); }} size="lg" variant="primary"><ChevronDown size={28} /></IconButton>
  </>;
}

// ยังไม่มีข้อความเลย ข้อความชวนเริ่มสนทนาต่างกันตามคู่สนทนา
function emptyConversationText(contact: ChatContact) {
  return contact.isSupport
    ? "ยังไม่มีข้อความ เริ่มสนทนากับแอดมินใหญ่"
    : `ยังไม่มีข้อความ เริ่มสนทนากับผู้เช่าห้อง ${contact.roomId}`;
}

// ชื่อที่แสดงของคู่สนทนา แอดมินใหญ่ไม่มีเลขห้อง
function contactTitle(contact: ChatContact) {
  return contact.isSupport ? "แอดมินใหญ่" : `ห้อง ${contact.roomId}`;
}

// หัวหน้าต่างคนละแบบ ในห้องสนทนามีปุ่มย้อนกลับกับชื่อคู่สนทนา
function ChatWidgetHeader({ contact, isExpanded, isMenuOpen, onBackToList, onClose, onToggleExpanded, onToggleMenu }: Readonly<{
  contact: ChatContact | undefined;
  isExpanded: boolean;
  isMenuOpen: boolean;
  onBackToList: () => void;
  onClose: () => void;
  onToggleExpanded: () => void;
  onToggleMenu: () => void;
}>) {
  if (!contact) {
    return <header className="chat-widget-header">
      <IconButton label="ย้อนกลับ" onClick={onClose}><ChevronLeft size={22} /></IconButton>
      <div className="chat-widget-brand"><strong>ข้อความ</strong></div>
      <IconButton label="ปิดหน้าต่างข้อความ" onClick={onClose}><X size={22} /></IconButton>
    </header>;
  }
  return <header className="chat-widget-header chat-conversation-header">
    <IconButton label="ย้อนกลับไปยังรายชื่อผู้เช่า" onClick={onBackToList}><ChevronLeft size={22} /></IconButton>
    <div className="chat-conversation-brand">
      <span className={`chat-person-avatar muted${contact.isSupport ? " support" : ""}`}>{contact.isSupport ? <Crown size={19} /> : contact.roomId}</span>
      <strong>{contactTitle(contact)}</strong>
    </div>
    <div className="chat-header-actions">
      <WindowOptionsMenu isExpanded={isExpanded} isMenuOpen={isMenuOpen} onToggleExpanded={onToggleExpanded} onToggleMenu={onToggleMenu} />
      <IconButton label="ปิดหน้าต่างข้อความ" onClick={onClose}><X size={22} /></IconButton>
    </div>
  </header>;
}

// รายชื่อคู่สนทนา แอดมินใหญ่ถูกปักไว้บนสุดเสมอ
function ContactList({ contacts, onOpen }: Readonly<{ contacts: ChatContact[]; onOpen: (contactId: string) => void }>) {
  return <div className="chat-tenant-list">
    {contacts.map((contact) => <button className={contact.isSupport ? "chat-support-contact" : ""} key={contact.id} onClick={() => onOpen(contact.id)} type="button">
      <span className={`chat-list-avatar${contact.isSupport ? " support" : ""}`}>{contact.isSupport ? <Crown size={20} /> : contact.roomId}</span>
      <span><strong>{contactTitle(contact)}</strong><small>{contact.isSupport ? "สอบถามปัญหาการใช้งานระบบ" : contact.name}</small></span>
      {contact.isSupport ? <Pin className="chat-pinned-icon" size={16} /> : null}
    </button>)}
  </div>;
}

// ท้ายหน้าต่าง ช่องพิมพ์ข้อความ หรือป้ายบอกว่าอ่านอย่างเดียวเมื่อส่งไม่ได้
function ChatFooter({ canSend, show, showReadOnlyNotice, ...composer }: Readonly<{
  attachment: File | null;
  canSend: boolean;
  error: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isSending: boolean;
  message: string;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  setAttachment: (file: File | null) => void;
  setError: (message: string) => void;
  setMessage: (value: string) => void;
  show: boolean;
  showReadOnlyNotice: boolean;
}>) {
  if (!show) return null;
  if (canSend) return <ChatComposer {...composer} canAttach={!showReadOnlyNotice} />;
  return <ReadOnlyNotice className="m-3">อ่านประวัติข้อความผู้เช่าได้ แต่ไม่สามารถส่งข้อความหรือไฟล์ใหม่ได้</ReadOnlyNotice>;
}
