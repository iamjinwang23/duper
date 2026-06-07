import { notFound } from "next/navigation";
import { adminClient } from "@/lib/supabase/admin";
import { runMatchPipeline } from "@/lib/matching/pipeline";
import { embeddingProvider } from "@/lib/embeddings";
import { MatchPicker } from "./MatchPicker";

export const dynamic = "force-dynamic";

type LuxRow = {
  id: string;
  name: string;
  image_url: string | null;
  tier: string;
};

export default async function MatchDetailPage({
  params,
}: {
  params: { luxId: string };
}) {
  const supabase = adminClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, image_url, tier")
    .eq("id", params.luxId)
    .single();
  const lux = data as unknown as LuxRow | null;

  if (!lux || lux.tier !== "luxury") notFound();

  const suggestions = await runMatchPipeline(params.luxId);

  return (
    <div>
      <h1 className="font-serif text-3xl mb-2">{lux.name}</h1>
      <p className="opacity-60 mb-6">
        DUPE PICKS — AI 후보 {suggestions.length}개. 확정할 듀프를 선택하세요.
      </p>
      {lux.image_url && (
        <img
          src={lux.image_url}
          alt={lux.name}
          className="w-48 h-48 object-cover rounded mb-8"
        />
      )}
      {suggestions.length === 0 ? (
        embeddingProvider() === "none" ? (
          <p className="text-amber-400">
            임베딩이 비활성화돼 있어(EMBEDDING_PROVIDER=none) 매칭을 돌릴 수 없습니다.
            공급자를 설정하고 SPA 상품 임베딩을 채운 뒤 다시 시도하세요.
          </p>
        ) : (
          <p className="text-amber-400">
            후보가 없습니다. SPA 풀에 같은 카테고리 상품을 배치 등록한 뒤 다시 시도하세요.
          </p>
        )
      ) : (
        <MatchPicker luxId={lux.id} suggestions={suggestions} />
      )}
    </div>
  );
}
