// การ์ดประกาศหนึ่งใบ ไม่มีอะไรให้กด จึงเป็น Server Component ได้
import { Panel } from "@/components/tenant/primitives";

export type TenantAnnouncement = {
  id: string; title: string; content: string;
  publishedAt: string | Date | null; publishAt: string | Date | null; createdAt: string | Date;
};

export function AnnouncementCard(item: TenantAnnouncement) {
  // เผยแพร่แล้วใช้เวลาเผยแพร่ ยังไม่ถึงเวลาก็ใช้เวลาที่ตั้งไว้ ไม่มีทั้งคู่ค่อยใช้เวลาสร้าง
  const shownAt = item.publishedAt ?? item.publishAt ?? item.createdAt;
  return <Panel key={item.id} title={item.title}>
    <p className="whitespace-pre-wrap">{item.content}</p>
    <time className="mt-3 block text-sm text-[#62646c]">{new Date(shownAt).toLocaleString("th-TH")}</time>
  </Panel>;
}
