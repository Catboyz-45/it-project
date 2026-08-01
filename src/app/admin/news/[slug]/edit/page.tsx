import { GeneralEditor } from "@/components/admin/content-editors";
export default async function EditNewsPage({ params }: { params: Promise<{ slug: string }> }) { return <GeneralEditor mode="edit" kind="news" idOrSlug={(await params).slug} />; }
