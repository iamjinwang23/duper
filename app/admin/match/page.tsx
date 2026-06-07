import Link from "next/link";
import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type LuxRow = {
  id: string;
  name: string;
  image_url: string | null;
  status: string;
};

export default async function MatchListPage() {
  const supabase = adminClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, image_url, status, created_at")
    .eq("tier", "luxury")
    .order("created_at", { ascending: false });
  const luxProducts = (data ?? []) as unknown as LuxRow[];

  return (
    <div>
      <h1 className="font-serif text-3xl mb-2">듀프 매칭</h1>
      <p className="opacity-60 mb-8">
        명품을 선택하면 SPA 풀에서 가까운 후보를 찾아 듀프를 확정합니다.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {luxProducts.map((p) => (
          <Link
            key={p.id}
            href={`/admin/match/${p.id}`}
            className="rounded-lg border border-neutral-800 overflow-hidden hover:border-neutral-600 transition"
          >
            {p.image_url ? (
              <img src={p.image_url} alt={p.name} className="w-full h-40 object-cover" />
            ) : (
              <div className="w-full h-40 bg-neutral-900" />
            )}
            <div className="p-3">
              <div className="text-sm font-medium truncate">{p.name}</div>
              <div className="text-xs mt-2 opacity-60">{p.status}</div>
            </div>
          </Link>
        ))}
      </div>
      {luxProducts.length === 0 && (
        <p className="opacity-60">등록된 명품이 없습니다. 먼저 명품 상품을 등록하세요.</p>
      )}
    </div>
  );
}
