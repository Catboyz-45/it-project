import Link from "next/link";
import { PlatformBrand } from "@/components/ui/PlatformBrand";

// หน้า 404 ของทั้งเว็บ แทนหน้าดำภาษาอังกฤษของ Next ผู้ใช้จะได้รู้ว่าเกิดอะไรและกลับไปต่อได้ทันที
export default function NotFound() {
  return <main className="grid min-h-screen place-items-center bg-[#f7f7fb] px-4 py-10 text-[#292a30]">
    <section aria-labelledby="not-found-title" className="grid w-full max-w-md justify-items-center gap-4 rounded-2xl border border-[#e4e4e7] bg-white p-8 text-center shadow-sm">
      <PlatformBrand imageClassName="size-12" />
      <p className="text-5xl font-bold text-brand">404</p>
      <h1 className="text-xl font-semibold" id="not-found-title">ไม่พบหน้าที่คุณต้องการ</h1>
      <p className="text-sm text-[#62646c]">ลิงก์อาจพิมพ์ผิด หรือหน้านี้ถูกย้ายไปแล้ว ลองกลับไปหน้าแรกแล้วเลือกเมนูอีกครั้ง</p>
      <Link className="primary-button" href="/">กลับหน้าแรก</Link>
    </section>
  </main>;
}
