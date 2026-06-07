import { adminClient } from "@/lib/supabase/admin";
import { ProductForm } from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const supabase = adminClient();
  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, tier")
    .order("tier", { ascending: false })
    .order("name");
  return (
    <div>
      <h1 className="font-serif text-3xl mb-8">New Product</h1>
      <ProductForm brands={brands ?? []} />
    </div>
  );
}
