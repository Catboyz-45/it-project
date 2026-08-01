import { ProjectEditor } from "@/components/admin/content-editors";
export default async function EditProjectPage({ params }: { params: Promise<{ slug: string }> }) { return <ProjectEditor mode="edit" idOrSlug={(await params).slug} />; }
