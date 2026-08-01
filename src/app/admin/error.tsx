"use client";
import { ErrorView } from "@/components/error-view";
export default function AdminError({ reset, error }: { reset: () => void; error: Error & { digest?: string } }) { return <ErrorView reset={reset} reference={error.digest} />; }
