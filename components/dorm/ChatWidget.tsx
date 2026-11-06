"use client";
// ต่อสตรีมข้อความ จัดการการเลื่อน และอัปโหลดไฟล์จากเบราว์เซอร์

import Link from "next/link";
import { SyntheticEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, Headset, Search, X } from "lucide-react";
import type { Tenant } from "@/types/dorm";
import { ReadOnlyNotice } from "@/components/dorm/ReadOnlyNotice";
import { useChatThread } from "@/components/chat/use-chat-thread";
import { ChatComposer, ChatEmptyState, ChatLauncher, ChatMessageList, UnreadBadge, WindowSizeButton } from "@/components/chat/ChatParts";
import { IconButton } from "@/components/ui/IconButton";
import { TicketChatThread, TicketIcon, TicketInboxRow, ticketStatusTone, ticketTypeLabel } from "@/components/chat/TicketChatThread";
import { chatListTime, chatRoomBadge } from "@/lib/chat-time";
import { ownerPagePath } from "@/lib/navigation-routes";
import { type TicketInboxItem, ticketsChangedEvent } from "@/lib/ticket-inbox";
import { formatTicketStatus } from "@/lib/ui-labels";

// หน้าต่างแชทมีสามหน้า รายการข้อความ ห้องแชท และห้องสนทนาของเรื่องแจ้ง
type ChatView = "tenants" | "chat" | "ticket";
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

// สั่งเปิดแชทจากที่อื่นในหน้า เช่นกดคุยในหน้าแจ้งซ่อม หรือกดรายการในกระดิ่ง
export type ChatOpenRequest = { nonce: number; ticketId?: string; filter?: ChatFilter };
type ChatFilter = "all" | "chat" | "tickets";

// เรื่องแจ้งในกล่องข้อความรวม ส่ง ticketId มาเพื่อให้เรื่องนั้นติดมาด้วยแม้ปิดไปนานแล้ว
async function loadTicketInbox(propertyId: string, ticketId?: string): Promise<TicketInboxItem[]> {
  const query = ticketId ? `?ticketId=${encodeURIComponent(ticketId)}` : "";
  const response = await fetch(`/api/v1/admin/properties/${propertyId}/ticket-inbox${query}`, { cache: "no-store" });
  const result = await response.json() as { data?: TicketInboxItem[] };
  if (!response.ok || !result.data) return [];
  return result.data;
}

// หน้าต่างแชทมุมจอฝั่งเจ้าของหอ คุยกับผู้เช่า ทีมช่วยเหลือ และในเรื่องแจ้งซ่อมหรือร้องเรียน
export function ChatWidget({
  onUnreadChanged,
  propertyId,
  readOnly = false,
  supportUnreadCount = 0,
  tenants,
  unreadCount = 0,
  openRequest,
}: Readonly<{
  // อ่านข้อความแล้ว ให้หน้าแม่โหลดตัวเลขบนกระดิ่ง เมนู และปุ่มแชทใหม่
  onUnreadChanged?: () => unknown;
  propertyId: string;
  readOnly?: boolean;
  supportUnreadCount?: number;
  tenants: Tenant[];
  unreadCount?: number;
  openRequest?: ChatOpenRequest;
}>) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [view, setView] = useState<ChatView>("tenants");
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, ConversationSummary>>({});
  const [tickets, setTickets] = useState<TicketInboxItem[]>([]);
  const [filter, setFilter] = useState<ChatFilter>("all");
  const [contactQuery, setContactQuery] = useState("");
  const composerInputRef = useRef<HTMLInputElement>(null);

  const refreshTenantUnread = useCallback(async () => {
    try {
      setSummaries(await loadConversationSummaries(propertyId));
    } catch {
      // ป้ายรายคนโหลดไม่ได้ก็ยังคุยได้ปกติ ไม่ต้องขึ้นข้อผิดพลาด
    }
  }, [propertyId]);

  const refreshTickets = useCallback(async (includeTicketId?: string) => {
    try {
      setTickets(await loadTicketInbox(propertyId, includeTicketId));
    } catch {
      // โหลดเรื่องแจ้งไม่ได้ แชทกับผู้เช่ายังใช้ได้ปกติ
    }
  }, [propertyId]);

  // โหลดใหม่ทุกครั้งที่กลับมาหน้ารายชื่อ จะได้เห็นว่าใครส่งมาใหม่ระหว่างที่ปิดหน้าต่างอยู่
  useEffect(() => {
    if (!isOpen || view !== "tenants") return;
    void refreshTenantUnread();
    void refreshTickets();
  }, [isOpen, refreshTenantUnread, refreshTickets, view]);

  const handleRead = useCallback(() => {
    void refreshTenantUnread();
    return onUnreadChanged?.();
  }, [onUnreadChanged, refreshTenantUnread]);

  // อ่านหรือเปลี่ยนเรื่องแจ้งแล้ว บอกหน้าแจ้งซ่อมที่เปิดอยู่ให้โหลดใหม่ด้วย
  const handleTicketChanged = useCallback(() => {
    window.dispatchEvent(new Event(ticketsChangedEvent));
    return onUnreadChanged?.();
  }, [onUnreadChanged]);

  // ข้าม nonce 0 ซึ่งเป็นค่าเริ่มต้น ไม่งั้นแชทจะเด้งเปิดเองตั้งแต่เข้าหน้า
  useEffect(() => {
    if (!openRequest || openRequest.nonce <= 0) return;
    setIsOpen(true);
    if (openRequest.ticketId) {
      const ticketId = openRequest.ticketId;
      void refreshTickets(ticketId).then(() => {
        setSelectedTicketId(ticketId);
        setView("ticket");
      });
      return;
    }
    setFilter(openRequest.filter ?? "all");
    setView("tenants");
  }, [openRequest, refreshTickets]);

  // ปักทีมช่วยเหลือไว้บนสุดเสมอ เพราะเป็นช่องทางขอความช่วยเหลือเรื่องระบบ
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
  const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId);

  // null แปลว่าไม่ได้อยู่ในห้องแชท ยังไม่ต้องโหลดข้อความ
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
  };
  const openTicket = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setView("ticket");
  };
  const backToList = () => setView("tenants");
  const close = () => setIsOpen(false);

  // เลื่อนสถานะเรื่องจากในแชท ใช้ API เดียวกับหน้าแจ้งซ่อม ส่งเวลาที่แก้ล่าสุดไปกันการบันทึกทับกัน
  const changeTicketStatus = async (ticket: TicketInboxItem, status: "ACKNOWLEDGED" | "RESOLVED") => {
    const response = await fetch(`/api/v1/admin/properties/${propertyId}/tickets/${ticket.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, expectedUpdatedAt: ticket.updatedAt }),
    });
    if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { error?: string }).error || "เปลี่ยนสถานะไม่สำเร็จ");
    await refreshTickets(ticket.id);
    void handleTicketChanged();
  };

  // ปิดอยู่ก็เหลือแค่ปุ่มลอยมุมจอ พร้อมป้ายจำนวนข้อความที่ยังไม่ได้อ่าน
  if (!isOpen) {
    return <ChatLauncher label="เปิดข้อความผู้เช่า" onClick={() => { setView("tenants"); setIsOpen(true); }} unreadCount={unreadCount} />;
  }

  return <>
    <aside className={`${view === "tenants" ? "chat-widget" : "chat-widget chat-mode"}${isExpanded ? " expanded" : ""}`} aria-label="ข้อความผู้เช่า">
      {view === "ticket" && selectedTicket ? <>
        <TicketHeader onBack={backToList} onClose={close} propertyId={propertyId} ticket={selectedTicket} />
        <TicketChatThread
          attachmentBase={`/api/v1/admin/properties/${propertyId}/tickets/${selectedTicket.id}/attachments`}
          endpoint={`/api/v1/admin/properties/${propertyId}/tickets/${selectedTicket.id}/replies`}
          inputRef={composerInputRef}
          key={selectedTicket.id}
          onRead={handleTicketChanged}
          onStatusChange={(status) => changeTicketStatus(selectedTicket, status)}
          readOnly={readOnly}
          ticket={selectedTicket}
          viewer="ADMIN"
        />
      </> : <>
        <ChatWidgetHeader
          contact={view === "chat" ? selectedContact : undefined}
          isExpanded={isExpanded}
          onBackToList={backToList}
          onClose={close}
          onToggleExpanded={() => setIsExpanded((current) => !current)}
        />

        <div className="chat-widget-body">
          {view !== "chat" ? <ContactList
            contacts={contacts}
            filter={filter}
            onFilterChange={setFilter}
            onOpen={openTenantChat}
            onOpenTicket={openTicket}
            onQueryChange={setContactQuery}
            query={contactQuery}
            summaryFor={(contact) => summaries[contact.id]}
            tickets={tickets}
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

        {/* โหมดอ่านอย่างเดียวยังคุยกับทีมช่วยเหลือได้ เพราะต้องใช้ติดต่อขอต่ออายุแพ็กเกจ */}
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
      </>}
    </aside>
    <IconButton className="chat-minimize-button" label="ย่อหน้าต่างแชท" onClick={close} size="lg" variant="primary"><ChevronDown size={28} /></IconButton>
  </>;
}

// หัวห้องสนทนาของเรื่องแจ้ง บอกชื่อเรื่อง ห้อง และสถานะ พร้อมลิงก์ไปหน้าเรื่องเต็ม
function TicketHeader({ onBack, onClose, propertyId, ticket }: Readonly<{
  onBack: () => void;
  onClose: () => void;
  propertyId: string;
  ticket: TicketInboxItem;
}>) {
  return <header className="chat-widget-header chat-conversation-header">
    <IconButton label="ย้อนกลับไปยังรายการข้อความ" onClick={onBack}><ChevronLeft size={20} /></IconButton>
    <div className="chat-conversation-brand">
      <span aria-hidden="true" className="chat-ticket-icon" data-size="sm" data-tone={ticketStatusTone(ticket.status)}><TicketIcon size={15} type={ticket.type} /></span>
      <span className="min-w-0">
        <strong className="block truncate">{ticket.title}</strong>
        <small className="block truncate">{ticketPlace(ticket)} · <span className="chat-ticket-status" data-tone={ticketStatusTone(ticket.status)}>{formatTicketStatus(ticket.status)}</span></small>
      </span>
    </div>
    <div className="chat-header-actions">
      <Link className="chat-ticket-detail-link" href={ownerPagePath(propertyId, "complaints")}>รายละเอียด</Link>
      <IconButton label="ปิดหน้าต่างข้อความ" onClick={onClose}><X size={20} /></IconButton>
    </div>
  </header>;
}

// บอกที่มาของเรื่อง ร้องเรียนแบบไม่ระบุชื่อไม่บอกห้องและชื่อ
function ticketPlace(ticket: TicketInboxItem) {
  if (!ticket.roomNumber) return ticket.isAnonymous ? "ผู้แจ้งไม่ระบุชื่อ" : "พื้นที่ส่วนกลาง";
  return `ห้อง ${ticket.roomNumber}`;
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
function ChatWidgetHeader({ contact, isExpanded, onBackToList, onClose, onToggleExpanded }: Readonly<{
  contact: ChatContact | undefined;
  isExpanded: boolean;
  onBackToList: () => void;
  onClose: () => void;
  onToggleExpanded: () => void;
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
      <WindowSizeButton isExpanded={isExpanded} onToggle={onToggleExpanded} />
      <IconButton label="ปิดหน้าต่างข้อความ" onClick={onClose}><X size={20} /></IconButton>
    </div>
  </header>;
}

// กล่องข้อความรวม ทีมช่วยเหลือปักไว้บนสุด ที่เหลือคือแชทกับห้องและเรื่องแจ้ง เรียงรวมกันตามความเคลื่อนไหวล่าสุด
// ค้นหาด้วยเลขห้อง ชื่อ หรือชื่อเรื่องได้ กรองดูเฉพาะแชทหรือเฉพาะเรื่องแจ้งได้
function ContactList({ contacts, filter, onFilterChange, onOpen, onOpenTicket, onQueryChange, query, summaryFor, tickets, unreadFor }: Readonly<{
  contacts: ChatContact[];
  filter: ChatFilter;
  onFilterChange: (filter: ChatFilter) => void;
  onOpen: (contactId: string) => void;
  onOpenTicket: (ticketId: string) => void;
  onQueryChange: (value: string) => void;
  query: string;
  summaryFor: (contact: ChatContact) => ConversationSummary | undefined;
  tickets: TicketInboxItem[];
  unreadFor: (contact: ChatContact) => number;
}>) {
  const normalized = query.trim().toLocaleLowerCase("th");
  const matches = (text: string) => !normalized || text.toLocaleLowerCase("th").includes(normalized);
  const [support, ...tenantContacts] = contacts;
  type Row = { at: string; contact?: ChatContact; key: string; ticket?: TicketInboxItem };
  const rows: Row[] = [
    ...(filter === "tickets" ? [] : tenantContacts
      .filter((contact) => matches(`${contact.roomId} ${contact.name} ${contactTitle(contact)}`))
      .map((contact) => ({ at: summaryFor(contact)?.lastMessageAt ?? "", contact, key: `chat-${contact.id}` }))),
    ...(filter === "chat" ? [] : tickets
      .filter((ticket) => matches(`${ticket.title} ${ticket.roomNumber ?? ""} ${ticket.tenantName ?? ""} ${ticketTypeLabel(ticket.type)}`))
      .map((ticket) => ({ at: ticket.lastActivityAt, key: `ticket-${ticket.id}`, ticket }))),
  ].sort((left, right) => right.at.localeCompare(left.at));
  const showSupport = filter !== "tickets" && matches(`${support.name} ช่วยเหลือ`);
  const unreadTickets = tickets.filter((ticket) => ticket.hasUnread).length;

  return <>
    <label className="chat-search">
      <Search aria-hidden="true" size={15} />
      <input aria-label="ค้นหาห้องหรือชื่อผู้เช่า" onChange={(event) => onQueryChange(event.target.value)} placeholder="ค้นหาห้อง ชื่อ หรือเรื่องแจ้ง" type="search" value={query} />
    </label>
    <div aria-label="กรองข้อความ" className="chat-filter" role="group">
      {([["all", "ทั้งหมด"], ["chat", "แชท"], ["tickets", "เรื่องแจ้ง"]] as const).map(([value, label]) => <button aria-pressed={filter === value} key={value} onClick={() => onFilterChange(value)} type="button">
        {label}{value === "tickets" && unreadTickets > 0 ? <span className="chat-filter-count">{unreadTickets}</span> : null}
      </button>)}
    </div>
    <div className="chat-tenant-list">
      {showSupport ? <ContactRow contact={support} onOpen={onOpen} summary={summaryFor(support)} unread={unreadFor(support)} /> : null}
      {rows.length === 0 && !showSupport ? <p className="chat-conversation-prompt py-6">{normalized ? "ไม่พบห้อง ชื่อ หรือเรื่องนี้" : filter === "tickets" ? "ยังไม่มีเรื่องแจ้งที่ต้องติดตาม" : "ยังไม่มีผู้เช่าในหอนี้"}</p> : null}
      {rows.map((row) => row.ticket
        ? <TicketInboxRow key={row.key} onOpen={onOpenTicket} place={ticketPlace(row.ticket)} ticket={row.ticket} />
        : <ContactRow contact={row.contact!} key={row.key} onOpen={onOpen} summary={summaryFor(row.contact!)} unread={unreadFor(row.contact!)} />)}
    </div>
  </>;
}

function ContactRow({ contact, onOpen, summary, unread }: Readonly<{
  contact: ChatContact;
  onOpen: (contactId: string) => void;
  summary: ConversationSummary | undefined;
  unread: number;
}>) {
  return <button className={contact.isSupport ? "chat-support-contact" : ""} data-unread={unread > 0 || undefined} onClick={() => onOpen(contact.id)} type="button">
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
