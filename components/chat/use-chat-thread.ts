"use client";
// ตรรกะร่วมของหน้าต่างแชททั้งฝั่งเจ้าของหอและฝั่งผู้ดูแลระบบ
// โหลดข้อความ ต่อสตรีมเรียลไทม์ โหลดข้อความเก่า ส่งข้อความและไฟล์แนบ
// สองหน้าต่างนั้นทำสิ่งเดียวกันเกือบทั้งหมด ต่างแค่ปลายทางของ API

import { SyntheticEvent, useCallback, useEffect, useRef, useState } from "react";

export type ChatThreadMessage = {
  id: string;
  body: string;
  senderRole: "ADMIN" | "TENANT" | "SUPER_ADMIN";
  senderName: string;
  createdAt: string;
  attachment: { name: string; mimeType: string; size: number; url: string } | null;
};

type LoadResult<T> = { conversationId?: string; error?: string; hasMore?: boolean; messages?: T[] };

// ไฟล์แนบส่งเป็น multipart ไปที่ปลายทางของไฟล์ ไม่ใช่ปลายทางของข้อความ
function attachmentRequest(conversationId: string, propertyId: string, body: string, clientId: string, file: File) {
  const formData = new FormData();
  formData.set("propertyId", propertyId);
  formData.set("body", body);
  formData.set("clientId", clientId);
  formData.set("file", file);
  return fetch(`/api/v1/chat/conversations/${conversationId}/attachments`, {
    method: "POST",
    headers: { "x-property-id": propertyId },
    body: formData,
  });
}

export function useChatThread<T extends ChatThreadMessage>({
  endpoint,
  onLoaded,
  propertyId,
  requireConversationId = false,
  streaming,
}: {
  // null แปลว่ายังไม่ได้เลือกห้องสนทนา จึงยังไม่ต้องโหลดอะไร
  endpoint: string | null;
  // ต้องเป็นฟังก์ชันที่ไม่เปลี่ยนตัวตนทุก render เช่นห่อด้วย useCallback
  // ไม่งั้น effect โหลดข้อความจะยิงซ้ำไม่จบ
  onLoaded?: () => void;
  propertyId: string | null;
  requireConversationId?: boolean;
  // เปิดสตรีมเฉพาะตอนหน้าต่างแชทเปิดอยู่ ไม่งั้นการเชื่อมต่อจะค้างสะสม
  streaming: boolean;
}) {
  const [messages, setMessages] = useState<T[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  // เริ่มที่ true เมื่อมีห้องสนทนาตั้งแต่แรก ไม่งั้นจะเห็นข้อความ "ยังไม่มีข้อความ" แวบหนึ่งก่อนโหลดเสร็จ
  const [isLoading, setIsLoading] = useState(() => Boolean(endpoint));
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // ปกติข้อความใหม่เข้ามาแล้วเลื่อนลงล่างสุด ยกเว้นตอนโหลดข้อความเก่ามาต่อข้างบน
  const shouldScrollToEndRef = useRef(true);

  // เช็ค id ซ้ำก่อนต่อท้าย เพราะข้อความที่เราส่งเองจะกลับมาทางสตรีมอีกรอบด้วย
  const appendMessage = useCallback((next: T) => {
    setMessages((current) => current.some((item) => item.id === next.id) ? current : [...current, next]);
  }, []);

  useEffect(() => {
    if (!endpoint) return;
    const controller = new AbortController();
    setIsLoading(true);
    setError("");
    void fetch(endpoint, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const result = await response.json() as LoadResult<T>;
      const missingConversation = requireConversationId && !result.conversationId;
      if (!response.ok || !result.messages || missingConversation) throw new Error(result.error || "โหลดข้อความไม่สำเร็จ");
      setMessages(result.messages);
      setHasOlderMessages(result.hasMore ?? false);
      setConversationId(result.conversationId ?? null);
      onLoaded?.();
    }).catch((loadError: unknown) => {
      // ยกเลิกเองตอนเปลี่ยนคู่สนทนา ไม่ใช่ข้อผิดพลาดจริง
      if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "โหลดข้อความไม่สำเร็จ");
    }).finally(() => {
      if (!controller.signal.aborted) setIsLoading(false);
    });
    return () => controller.abort();
  }, [endpoint, onLoaded, requireConversationId]);

  useEffect(() => {
    if (!streaming || !conversationId || !propertyId) return;
    // EventSource รับข้อความใหม่จากเซิร์ฟเวอร์ทางเดียว เบากว่าถามซ้ำ ๆ และเบราว์เซอร์ต่อใหม่ให้เองเมื่อหลุด
    // after เป็นเวลาปัจจุบัน เพราะข้อความเก่าโหลดมาแล้วจาก effect ข้างบน
    const stream = new EventSource(`/api/v1/chat/conversations/${conversationId}/stream?propertyId=${encodeURIComponent(propertyId)}&after=${encodeURIComponent(new Date().toISOString())}`);
    stream.onmessage = (event) => {
      try {
        appendMessage(JSON.parse(event.data) as T);
      } catch {
        setError("รับข้อความใหม่ไม่สำเร็จ");
      }
    };
    stream.onerror = () => setError("การเชื่อมต่อเรียลไทม์ขัดข้อง ระบบกำลังเชื่อมต่อใหม่");
    // ต่อติดแล้วก็ล้างข้อความเตือนทิ้ง ผู้ใช้จะได้รู้ว่ากลับมาปกติแล้ว
    stream.onopen = () => setError("");
    // ต้องปิดสตรีมตอนออกจากหน้า ไม่งั้นการเชื่อมต่อจะค้างสะสม
    return () => stream.close();
  }, [appendMessage, conversationId, propertyId, streaming]);

  // เลื่อนลงล่างสุดเมื่อมีข้อความใหม่ แล้วรีเซ็ตธงกลับเป็นค่าปกติทันที
  useEffect(() => {
    if (shouldScrollToEndRef.current) endRef.current?.scrollIntoView({ behavior: "smooth" });
    shouldScrollToEndRef.current = true;
  }, [messages]);

  // โหลดข้อความเก่ากว่ามาต่อข้างบน พร้อมชดเชยการเลื่อนไม่ให้หน้ากระโดด
  const loadOlderMessages = async () => {
    const oldest = messages[0];
    if (!endpoint || !oldest || isLoadingOlder) return;
    setIsLoadingOlder(true);
    setError("");
    // จำความสูงเดิมไว้ก่อน เดี๋ยวใช้คำนวณชดเชยการเลื่อนหลังข้อความเก่าถูกแทรกเข้ามา
    const container = scrollRef.current;
    const previousHeight = container?.scrollHeight ?? 0;
    try {
      // อ้างอิงจาก id ของข้อความเก่าสุดที่มีอยู่ ไม่ใช้เลขหน้า เพราะข้อความใหม่เข้ามาแล้วเลขหน้าจะเลื่อน
      const search = new URLSearchParams({ beforeMessageId: oldest.id, limit: "50" });
      const response = await fetch(`${endpoint}?${search}`, { cache: "no-store" });
      const result = await response.json() as LoadResult<T>;
      if (!response.ok || !result.messages) throw new Error(result.error || "โหลดข้อความก่อนหน้าไม่สำเร็จ");
      const older = result.messages;
      // ครั้งนี้อย่าเลื่อนลงล่าง ผู้ใช้กำลังอ่านข้อความเก่าอยู่
      shouldScrollToEndRef.current = false;
      setMessages((current) => [...older.filter((item) => !current.some((existing) => existing.id === item.id)), ...current]);
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

  const sendMessage = async (event: SyntheticEvent<HTMLFormElement>) => {
    // กันเบราว์เซอร์รีเฟรชหน้าตามพฤติกรรมฟอร์มปกติ
    event.preventDefault();
    const body = message.trim();
    // ส่งได้ถ้ามีข้อความหรือมีไฟล์อย่างใดอย่างหนึ่ง และต้องไม่กำลังส่งอยู่
    if ((!body && !attachment) || !endpoint || !propertyId || isSending) return;
    setIsSending(true);
    setError("");
    try {
      // id ที่ฝั่งเราสร้าง ให้เซิร์ฟเวอร์ใช้กันบันทึกซ้ำถ้าคำขอถูกส่งซ้ำ
      const clientId = crypto.randomUUID();
      if (!conversationId) throw new Error("ยังไม่พบบทสนทนา");
      const response = attachment
        ? await attachmentRequest(conversationId, propertyId, body, clientId, attachment)
        : await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body, clientId }),
        });
      const result = await response.json() as { error?: string; message?: T };
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

  return {
    attachment,
    conversationId,
    endRef,
    error,
    fileInputRef,
    hasOlderMessages,
    isLoading,
    isLoadingOlder,
    isSending,
    loadOlderMessages,
    message,
    messages,
    scrollRef,
    sendMessage,
    setAttachment,
    setError,
    setMessage,
  };
}
