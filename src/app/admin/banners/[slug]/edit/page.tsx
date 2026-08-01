import { GeneralEditor } from "@/components/admin/content-editors";
export default async function EditBannerPage({ params }: { params: Promise<{ slug: string }> }) { return <GeneralEditor mode="edit" kind="banner" idOrSlug={(await params).slug} />; }
