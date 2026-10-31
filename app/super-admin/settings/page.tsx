import { PlatformPaymentSettingsForm } from "@/components/admin/PlatformPaymentSettingsForm";
import { SuperAdminPageHeader } from "@/components/admin/SuperAdminPageHeader";
import { getPlatformPaymentSettings } from "@/lib/server/payment-accounts";

// หน้าตั้งค่าระบบของ Super Admin ตอนนี้มีบัญชีรับค่าแพ็กเกจที่เจ้าของหอต้องโอนเข้า
export default async function SuperAdminSettingsPage() {
  // layout ตรวจบทบาทไปแล้ว ตรงนี้ดึงค่าปัจจุบันให้มาพร้อม HTML
  const { bankName, bankAccountNumber, bankAccountName, promptPayId } = await getPlatformPaymentSettings();
  return <>
    <SuperAdminPageHeader description="ตั้งค่าช่องทางรับค่าแพ็กเกจที่แสดงให้เจ้าของหอเห็นตอนต่ออายุ" title="ตั้งค่าระบบ" />
    <PlatformPaymentSettingsForm initialSettings={{ bankName, bankAccountNumber, bankAccountName, promptPayId }} />
  </>;
}
