"use client";
import { ErrorView } from "@/components/error-view";
export default function PublicError({ reset, error }: { reset: () => void; error: Error & { digest?: string } }) { return <div className="container section"><ErrorView reset={reset} reference={error.digest} /></div>; }
