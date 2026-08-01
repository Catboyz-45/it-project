import { AdminPageHeader } from "@/components/admin-shell";
import { CompanyForm } from "@/components/company-form";

export default function CompanyPage() { return <><AdminPageHeader title="ข้อมูลบริษัท" description="ข้อมูลส่วนนี้จะแสดงในหน้าเกี่ยวกับเรา ติดต่อ และส่วนท้ายเว็บไซต์" /><section className="panel"><div className="panel-header"><h2>ข้อมูลทั่วไป</h2><span className="status">บันทึกอัตโนมัติ: ปิด</span></div><CompanyForm /></section></>; }
