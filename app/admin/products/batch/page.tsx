import { adminClient } from "@/lib/supabase/admin";
import { BatchForm } from "@/app/admin/products/batch/BatchForm";

export const dynamic = "force-dynamic";

export default async function BatchProductPage() {
  const supabase = adminClient();
  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, tier")
    .order("tier", { ascending: false })
    .order("name");
  return (
    <div>
      <h1 className="font-serif text-3xl mb-2">배치 등록</h1>
      <p className="text-sm opacity-60 mb-8">
        SPA 후보 풀을 채우기 위해 여러 상품 URL을 한 번에 등록합니다. 각 상품은 draft 상태로 저장됩니다.
      </p>
      <BatchForm brands={brands ?? []} />
    </div>
  );
}
