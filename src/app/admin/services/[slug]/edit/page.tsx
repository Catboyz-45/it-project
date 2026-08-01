import { GeneralEditor } from "@/components/admin/content-editors";
export default async function EditServicePage({ params }: { params: Promise<{ slug: string }> }) { return <GeneralEditor mode="edit" kind="service" idOrSlug={(await params).slug} />; }
