"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
export function LogoutButton() { const router = useRouter(); const [busy, setBusy] = useState(false); async function logout() { setBusy(true); const response = await fetch("/api/auth/logout", { method: "POST" }).catch(() => null); if (response?.ok) { router.replace("/login"); router.refresh(); } else setBusy(false); } return <button type="button" className="icon-btn" onClick={logout} disabled={busy} aria-label="ออกจากระบบ"><LogOut size={19} /></button>; }
