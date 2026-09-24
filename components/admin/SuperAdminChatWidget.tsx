"use client";
// เก็บสถานะการสนทนา จัดการการเลื่อน และอัปโหลดไฟล์จากเบราว์เซอร์

import { useCallback, useEffect, useState } from "react";
import { Building2, ChevronDown, ChevronLeft, X } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { LoadMoreButton } from "@/components/ui/DataNavigation";
import { useChatThread } from "@/components/chat/use-chat-thread";
import { ChatComposer, ChatLauncher, ChatMessageList, UnreadBadge, WindowOptionsMenu } from "@/components/chat/ChatParts";

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
  const [listError, setListError] = useState("");

  const loadConversations = useCallback(async (targetPage = 1, append = false) => {
    if (append) setIsLoadingMore(true);
    else setIsLoadingList(true);
    setListError("");
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
      setListError(loadError instanceof Error ? loadError.message : "โหลดรายการสนทนาไม่สำเร็จ");
    } finally {
      setIsLoadingList(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => { void loadConversations(); }, [loadConversations]);

  // เปิดห้องไหนก็ถือว่าอ่านแล้ว ล้างป้ายจำนวนของห้องนั้นในรายการทันที
  const markSelectedRead = useCallback(() => {
    setConversations((current) => current.map((item) => item.id === selected?.id ? { ...item, unreadCount: 0 } : item));
  }, [selected?.id]);

  const {
    attachment, endRef, error: threadError, fileInputRef, hasOlderMessages,
    isLoading: isLoadingMessages, isLoadingOlder, isSending, loadOlderMessages, message,
    messages, scrollRef, sendMessage, setAttachment, setError, setMessage,
  } = useChatThread<SupportMessage>({
    endpoint: selected ? `/api/v1/super-admin/properties/${selected.propertyId}/support-chat` : null,
    onLoaded: markSelectedRead,
    propertyId: selected?.propertyId ?? null,
    requireConversationId: true,
    streaming: isOpen,
  });
  // รายการสนทนากับห้องสนทนาโหลดคนละที่ แสดงอันที่เกิดขึ้นก่อน
  const error = listError || threadError;

  // รวมยอดที่ยังไม่ได้อ่านจากทุกหอ ไว้แสดงเป็นป้ายบนปุ่มลอยมุมจอ
  const unreadCount = conversations.reduce((sum, item) => sum + item.unreadCount, 0);

  // ปิดอยู่ก็เหลือแค่ปุ่มลอยมุมจอ พร้อมป้ายจำนวนข้อความที่ยังไม่ได้อ่าน
  if (!isOpen) return <ChatLauncher label="เปิดข้อความจากหอพัก" onClick={() => setIsOpen(true)} unreadCount={unreadCount} />;

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
          <WindowOptionsMenu
            isExpanded={isExpanded}
            isMenuOpen={isOptionsOpen}
            onToggleExpanded={() => { setIsExpanded((current) => !current); setIsOptionsOpen(false); }}
            onToggleMenu={() => setIsOptionsOpen((current) => !current)}
          />
          <IconButton label="ปิดหน้าต่างข้อความ" onClick={() => setIsOpen(false)}><X aria-hidden="true" size={22} /></IconButton>
        </div>
      </header>

      {error && !selected ? <p className="chat-error mx-3 mt-3" role="alert">{error}</p> : null}

      <div className="chat-widget-body">
        {!selected ? <ConversationList
          conversations={conversations}
          hasNextPage={hasNextPage}
          isLoading={isLoadingList}
          isLoadingMore={isLoadingMore}
          onLoadMore={() => void loadConversations(page + 1, true)}
          onOpen={(conversation) => { setSelected(conversation); setIsOptionsOpen(false); }}
        /> : (
          <ChatMessageList
            emptyText="ยังไม่มีข้อความ เริ่มสนทนากับหอพักได้เลย"
            endRef={endRef}
            hasOlderMessages={hasOlderMessages}
            isLoading={isLoadingMessages}
            isLoadingOlder={isLoadingOlder}
            messages={messages}
            onLoadOlder={() => void loadOlderMessages()}
            ownRole="SUPER_ADMIN"
            scrollRef={scrollRef}
          />
        )}
      </div>

      {selected ? <ChatComposer
        attachment={attachment}
        error={error}
        fileInputRef={fileInputRef}
        isSending={isSending}
        message={message}
        onSubmit={sendMessage}
        setAttachment={setAttachment}
        setError={setError}
        setMessage={setMessage}
      /> : null}
    </aside>
    <IconButton className="chat-minimize-button" label="ย่อหน้าต่างแชท" onClick={() => setIsOpen(false)} size="lg" variant="primary"><ChevronDown aria-hidden="true" size={28} /></IconButton>
  </>;
}

// รายการห้องสนทนาของทุกหอ เรียงตามที่เซิร์ฟเวอร์ส่งมา
function ConversationList({ conversations, hasNextPage, isLoading, isLoadingMore, onLoadMore, onOpen }: Readonly<{
  conversations: SupportConversation[];
  hasNextPage: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onOpen: (conversation: SupportConversation) => void;
}>) {
  return <div className="chat-tenant-list">
    {isLoading ? <p className="chat-conversation-prompt py-8">กำลังโหลดรายการสนทนา...</p> : null}
    {!isLoading && conversations.length === 0 ? <p className="chat-conversation-prompt py-8">ยังไม่มีข้อความจากหอพัก</p> : null}
    {conversations.map((conversation) => <button key={conversation.id} onClick={() => onOpen(conversation)} type="button">
      <span className="chat-list-avatar support"><Building2 aria-hidden="true" size={19} /></span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate">{conversation.propertyName}</strong>
        <small>{conversation.lastMessageAt ? `ล่าสุด ${new Date(conversation.lastMessageAt).toLocaleString("th-TH")}` : "ยังไม่มีข้อความ"}</small>
      </span>
      <UnreadBadge className="notification-badge" count={conversation.unreadCount} />
    </button>)}
    {hasNextPage ? <LoadMoreButton isLoading={isLoadingMore} label="โหลดหอพักเพิ่มเติม" onClick={onLoadMore} /> : null}
  </div>;
}
