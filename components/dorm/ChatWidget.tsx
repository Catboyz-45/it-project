"use client";
// ต่อสตรีมข้อความ จัดการการเลื่อน และอัปโหลดไฟล์จากเบราว์เซอร์

import { SyntheticEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, Headset, Search, X } from "lucide-react";
import type { Tenant } from "@/types/dorm";
import { ReadOnlyNotice } from "@/components/dorm/ReadOnlyNotice";
import { useChatThread } from "@/components/chat/use-chat-thread";
import { ChatComposer, ChatEmptyState, ChatLauncher, ChatMessageList, UnreadBadge, WindowOptionsMenu } from "@/components/chat/ChatParts";
import { IconButton } from "@/components/ui/IconButton";
import { chatListTime, chatRoomBadge } from "@/lib/chat-time";

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
// ชื่อห้องสนทนากับฝั่งแพลตฟอร์ม ตรงกับชื่อผู้ส่งที่เซิร์ฟเวอร์ใส่ให้ข้อความจากแอดมินใหญ่
const supportTeamName = "ทีมช่วยเหลือ Nestly";

// isSupport แยกแอดมินใหญ่ออกจากผู้เช่า เพราะใช้คนละ API และแสดงผลต่างกัน
type ChatContact = { id: string; isSupport?: boolean; name: string; roomId: string };
// สรุปห้องสนทนาของผู้เช่าแต่ละคน ใช้บอกเวลาและข้อความล่าสุดในรายชื่อ
type ConversationSummary = {
  lastMessage: { body: string; fromSelf: boolean; hasAttachment: boolean } | null;
  lastMessageAt: string | null;
  unreadCount: number;
};

// คนละ API เพราะสิทธิ์ต่างกัน คุยกับแอดมินใหญ่เป็นช่องทางช่วยเหลือของหอ
// ส่วนคุยกับผู้เช่าต้องเป็นผู้เช่าในหอนี้เท่านั้น
function contactEndpoint(propertyId: string, contactId: string, isSupport?: boolean) {
  return isSupport
    ? `/api/v1/admin/properties/${propertyId}/support-chat`
    : `/api/v1/admin/properties/${propertyId}/tenant-chat/${contactId}`;
}

// สรุปห้องสนทนาของผู้เช่าทุกคน จำนวนที่ยังไม่อ่าน เวลา และข้อความล่าสุด
async function loadConversationSummaries(propertyId: string): Promise<Record<string, ConversationSummary>> {
  const response = await fetch(`/api/v1/admin/properties/${propertyId}/tenant-chat?pageSize=100`, { cache: "no-store" });
  const result = await response.json() as { conversations?: Array<ConversationSummary & { tenant: { id: string } | null }> };
  if (!response.ok || !result.conversations) return {};
  return Object.fromEntries(result.conversations
    .filter((conversation) => conversation.tenant)
    .map(({ lastMessage, lastMessageAt, tenant, unreadCount }) => [tenant!.id, { lastMessage, lastMessageAt, unreadCount }]));
}

// บรรทัดที่สองของรายชื่อ ข้อความล่าสุดพร้อมบอกว่าใครพูด ยังไม่เคยคุยก็บอกชื่อผู้เช่าแทน
function previewText(contact: ChatContact, summary: ConversationSummary | undefined) {
  if (contact.isSupport) return "ช่วยเหลือการใช้งานระบบ";
  const last = summary?.lastMessage;
  if (!last) return "ยังไม่มีข้อความ";
  const body = last.body || (last.hasAttachment ? "ส่งไฟล์แนบ" : "");
  return last.fromSelf ? `คุณ: ${body}` : body;
}

// หน้าต่างแชทมุมจอฝั่งเจ้าของหอ คุยกับผู้เช่าและกับแอดมินใหญ่
export function ChatWidget({
  onUnreadChanged,
  propertyId,
  readOnly = false,
  supportUnreadCount = 0,
  tenants,
  unreadCount = 0,
  // ตัวเลขที่เพิ่มขึ้นจากหน้าแม่เพื่อสั่งเปิดแชท ใช้ตัวเลขเพราะสั่งเปิดซ้ำได้เรื่อย ๆ
  openSignal = 0,
}: Readonly<{
  // อ่านข้อความแล้ว ให้หน้าแม่โหลดตัวเลขบนกระดิ่ง เมนู และปุ่มแชทใหม่
  onUnreadChanged?: () => unknown;
  propertyId: string;
  readOnly?: boolean;
  supportUnreadCount?: number;
  tenants: Tenant[];
  unreadCount?: number;
  openSignal?: number;
}>) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [view, setView] = useState<ChatView>("tenants");
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, ConversationSummary>>({});
  const [contactQuery, setContactQuery] = useState("");
  const composerInputRef = useRef<HTMLInputElement>(null);

  const refreshTenantUnread = useCallback(async () => {
    try {
      setSummaries(await loadConversationSummaries(propertyId));
    } catch {
      // ป้ายรายคนโหลดไม่ได้ก็ยังคุยได้ปกติ ไม่ต้องขึ้นข้อผิดพลาด
    }
  }, [propertyId]);

  // โหลดใหม่ทุกครั้งที่กลับมาหน้ารายชื่อ จะได้เห็นว่าใครส่งมาใหม่ระหว่างที่ปิดหน้าต่างอยู่
  useEffect(() => {
    if (!isOpen || view !== "tenants") return;
    void refreshTenantUnread();
  }, [isOpen, refreshTenantUnread, view]);

  const handleRead = useCallback(() => {
    void refreshTenantUnread();
    return onUnreadChanged?.();
  }, [onUnreadChanged, refreshTenantUnread]);
  // ข้าม 0 ซึ่งเป็นค่าเริ่มต้น ไม่งั้นแชทจะเด้งเปิดเองตั้งแต่เข้าหน้า
  useEffect(() => {
    if (openSignal <= 0) return;
    setView("tenants");
    setIsOpen(true);
  }, [openSignal]);

  // ปักแอดมินใหญ่ไว้บนสุดเสมอ เพราะเป็นช่องทางขอความช่วยเหลือเรื่องระบบ
  // ผู้เช่าเรียงตามที่คุยล่าสุด คนที่ยังไม่เคยคุยต่อท้ายเรียงตามเลขห้อง
  const contacts = useMemo<ChatContact[]>(
    () => [
      { id: "super-admin", isSupport: true, name: supportTeamName, roomId: "SUPPORT" },
      ...tenants
        .map((tenant) => ({ id: tenant.id, name: tenant.name, roomId: tenant.roomId }))
        .sort((left, right) => {
          const leftAt = summaries[left.id]?.lastMessageAt ?? "";
          const rightAt = summaries[right.id]?.lastMessageAt ?? "";
          if (leftAt !== rightAt) return rightAt.localeCompare(leftAt);
          return left.roomId.localeCompare(right.roomId, "th", { numeric: true });
        }),
    ],
    [summaries, tenants],
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
    isReady, isSending, loadOlderMessages, message, messages, scrollRef, sendMessage,
    setAttachment, setError, setMessage,
  } = useChatThread<ChatMessage>({ endpoint, onRead: handleRead, propertyId, streaming: isOpen });

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
        {view === "tenants" ? <ContactList
          contacts={contacts}
          onOpen={openTenantChat}
          onQueryChange={setContactQuery}
          query={contactQuery}
          summaryFor={(contact) => summaries[contact.id]}
          unreadFor={(contact) => contact.isSupport ? supportUnreadCount : summaries[contact.id]?.unreadCount ?? 0}
        /> : null}

        {view === "chat" && selectedContact ? <ChatMessageList
          emptyState={<ChatEmptyState
            description={selectedContact.isSupport ? "ถามเรื่องการใช้งานระบบหรือแพ็กเกจได้ที่นี่" : `ข้อความจะส่งถึง ${selectedContact.name} ห้อง ${selectedContact.roomId}`}
            onSuggest={(text) => { setMessage(text); composerInputRef.current?.focus(); }}
            suggestions={selectedContact.isSupport ? ["สอบถามการใช้งาน", "ต่ออายุแพ็กเกจ"] : ["แจ้งบิลเดือนนี้", "มีพัสดุมาถึง"]}
            title={selectedContact.isSupport ? "เริ่มคุยกับทีมช่วยเหลือ" : "เริ่มคุยกับผู้เช่า"}
          />}
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
        inputRef={composerInputRef}
        isReady={isReady}
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

// ชื่อที่แสดงของคู่สนทนา แอดมินใหญ่ไม่มีเลขห้อง
function contactTitle(contact: ChatContact) {
  return contact.isSupport ? supportTeamName : `ห้อง ${contact.roomId}`;
}

// วงกลมรูปโปรไฟล์ แอดมินใหญ่เป็นไอคอน ผู้เช่าเป็นเลขห้องแบบสั้น
function ContactAvatar({ contact, size = "md" }: Readonly<{ contact: ChatContact; size?: "sm" | "md" }>) {
  return <span aria-hidden="true" className={`chat-list-avatar${contact.isSupport ? " support" : ""}`} data-size={size}>
    {contact.isSupport ? <Headset size={size === "sm" ? 15 : 18} /> : chatRoomBadge(contact.roomId)}
  </span>;
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
    // หน้ารายชื่อเป็นหน้าแรกของหน้าต่าง ไม่มีที่ให้ย้อนกลับ ปุ่มย้อนกลับที่ทำงานเหมือนปุ่มปิดทำให้สับสน
    return <header className="chat-widget-header">
      <div className="chat-widget-brand"><strong>ข้อความ</strong></div>
      <IconButton label="ปิดหน้าต่างข้อความ" onClick={onClose}><X size={20} /></IconButton>
    </header>;
  }
  return <header className="chat-widget-header chat-conversation-header">
    <IconButton label="ย้อนกลับไปยังรายชื่อผู้เช่า" onClick={onBackToList}><ChevronLeft size={20} /></IconButton>
    <div className="chat-conversation-brand">
      <ContactAvatar contact={contact} size="sm" />
      <span className="min-w-0">
        <strong className="block truncate">{contact.isSupport ? supportTeamName : contact.name}</strong>
        <small className="block truncate">{contact.isSupport ? "ช่วยเหลือการใช้งานระบบ" : `ห้อง ${contact.roomId}`}</small>
      </span>
    </div>
    <div className="chat-header-actions">
      <WindowOptionsMenu isExpanded={isExpanded} isMenuOpen={isMenuOpen} onToggleExpanded={onToggleExpanded} onToggleMenu={onToggleMenu} />
      <IconButton label="ปิดหน้าต่างข้อความ" onClick={onClose}><X size={20} /></IconButton>
    </div>
  </header>;
}

// รายชื่อคู่สนทนา แอดมินใหญ่ถูกปักไว้บนสุดเสมอ ค้นหาด้วยเลขห้องหรือชื่อได้
function ContactList({ contacts, onOpen, onQueryChange, query, summaryFor, unreadFor }: Readonly<{
  contacts: ChatContact[];
  onOpen: (contactId: string) => void;
  onQueryChange: (value: string) => void;
  query: string;
  summaryFor: (contact: ChatContact) => ConversationSummary | undefined;
  unreadFor: (contact: ChatContact) => number;
}>) {
  const normalized = query.trim().toLocaleLowerCase("th");
  const visible = normalized
    ? contacts.filter((contact) => `${contact.roomId} ${contact.name} ${contactTitle(contact)}`.toLocaleLowerCase("th").includes(normalized))
    : contacts;
  return <>
    <label className="chat-search">
      <Search aria-hidden="true" size={15} />
      <input aria-label="ค้นหาห้องหรือชื่อผู้เช่า" onChange={(event) => onQueryChange(event.target.value)} placeholder="ค้นหาห้องหรือชื่อ" type="search" value={query} />
    </label>
    <div className="chat-tenant-list">
      {visible.length === 0 ? <p className="chat-conversation-prompt py-6">ไม่พบห้องหรือชื่อนี้</p> : null}
      {visible.map((contact) => {
        const summary = summaryFor(contact);
        const unread = unreadFor(contact);
        return <button className={contact.isSupport ? "chat-support-contact" : ""} data-unread={unread > 0 || undefined} key={contact.id} onClick={() => onOpen(contact.id)} type="button">
          <ContactAvatar contact={contact} />
          <span className="chat-contact-text">
            <span className="chat-contact-line">
              <strong>{contact.isSupport ? supportTeamName : `ห้อง ${contact.roomId} · ${contact.name}`}</strong>
              <small>{contact.isSupport ? "ปักหมุด" : summary?.lastMessageAt ? chatListTime(summary.lastMessageAt) : ""}</small>
            </span>
            <span className="chat-contact-line">
              <small className="chat-contact-preview">{previewText(contact, summary)}</small>
              <UnreadBadge className="chat-unread-badge" count={unread} />
            </span>
          </span>
        </button>;
      })}
    </div>
  </>;
}

// ท้ายหน้าต่าง ช่องพิมพ์ข้อความ หรือป้ายบอกว่าอ่านอย่างเดียวเมื่อส่งไม่ได้
function ChatFooter({ canSend, show, showReadOnlyNotice, ...composer }: Readonly<{
  attachment: File | null;
  canSend: boolean;
  error: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  isReady: boolean;
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
