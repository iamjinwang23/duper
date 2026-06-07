import Link from "next/link";
import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  tier: string;
  category: string;
  status: string;
  image_url: string | null;
  brands: { name: string } | null;
};

export default async function AdminProductsPage() {
  const supabase = adminClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, slug, tier, category, status, created_at, image_url, brands(name)")
    .order("created_at", { ascending: false })
    .limit(100);
  const products = (data ?? []) as unknown as ProductRow[];

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="font-serif text-3xl">Products</h1>
        <Link href="/admin/products/new" className="rounded-md bg-white text-neutral-900 px-4 py-2 text-sm">
          + New
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((p) => (
          <Link
            key={p.id}
            href={`/admin/products/${p.id}`}
            className="rounded-lg border border-neutral-800 overflow-hidden hover:border-neutral-600 transition"
          >
            {p.image_url ? (
              <img src={p.image_url} alt={p.name} className="w-full h-40 object-cover" />
            ) : (
              <div className="w-full h-40 bg-neutral-900" />
            )}
            <div className="p-3">
              <div className="text-xs opacity-60">{p.brands?.name} · {p.tier}</div>
              <div className="text-sm font-medium mt-1 truncate">{p.name}</div>
              <div className="flex justify-between text-xs mt-2 opacity-60">
                <span>{p.category}</span>
                <span>{p.status}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      {products.length === 0 && (
        <p className="opacity-60">No products yet. Click + New to register your first.</p>
      )}
    </div>
  );
}
