import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 60;

type HomeRow = {
  id: string;
  slug: string;
  name: string;
  image_url: string | null;
  price_amount: number | null;
  price_currency: string;
  brands: { name: string } | null;
};

export default async function HomePage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("products")
    .select("*, brands(name)")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(40);
  const products = (data ?? []) as unknown as HomeRow[];

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <header className="max-w-6xl mx-auto py-12">
        <h1 className="font-serif text-5xl mb-2">DUPE</h1>
        <p className="opacity-60 text-sm">생로랑 맛 자라. 르메르 맛 COS.</p>
      </header>
      <section className="max-w-6xl mx-auto">
        {products.length === 0 ? (
          <p className="opacity-60">아직 등록된 상품이 없어요.</p>
        ) : (
          <div className="columns-2 md:columns-3 lg:columns-4 gap-2">
            {products.map((p) => (
              <Link
                key={p.id}
                href={`/p/${p.slug}`}
                className="block mb-2 break-inside-avoid rounded-lg overflow-hidden border border-neutral-800"
              >
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-auto block" />
                ) : (
                  <div className="w-full aspect-[3/4] bg-neutral-900" />
                )}
                <div className="p-2">
                  <div className="text-[10px] uppercase opacity-60">{p.brands?.name}</div>
                  <div className="text-xs truncate">{p.name}</div>
                  {p.price_amount && (
                    <div className="text-[11px] opacity-70 mt-1">
                      {p.price_currency} {Number(p.price_amount).toLocaleString()}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
