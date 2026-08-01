import { AdminAccounts } from "@/components/admin-accounts";
import { requireAdmin } from "@/server/auth/session";
export default async function AdminsPage() { await requireAdmin(["SUPER_ADMIN"]); return <AdminAccounts />; }
