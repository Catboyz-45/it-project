import { ProductEditor } from "@/components/admin/content-editors";
export default async function EditProductPage({ params }: { params: Promise<{ slug: string }> }) { return <ProductEditor mode="edit" idOrSlug={(await params).slug} />; }
