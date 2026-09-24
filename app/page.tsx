import { redirect } from "next/navigation";
import { getPageAuth } from "@/lib/server/auth";
import { roleHomePath } from "@/lib/navigation-routes";

// หน้าแรกไม่มีเนื้อหาของตัวเอง ทำหน้าที่ส่งต่อไปยังพื้นที่ของแต่ละบทบาท
export default async function HomePage() {
  const auth = await getPageAuth();
  // ยังไม่ได้เข้าระบบก็ไปหน้าเข้าสู่ระบบ
  if (!auth) redirect("/login");
  // แยกตามบทบาท เพราะสามฝ่ายใช้คนละพื้นที่และเห็นข้อมูลคนละชุด
  redirect(roleHomePath(auth.role));
}
