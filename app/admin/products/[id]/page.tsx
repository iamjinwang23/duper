import { notFound } from "next/navigation";
import { adminClient } from "@/lib/supabase/admin";
import { publishProduct, archiveProduct, deleteProduct } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminProductDetail({ params }: { params: { id: string } }) {
  const supabase = adminClient();
  const { data: p } = await supabase
    .from("products")
    .select("*, brands(name, tier)")
    .eq("id", params.id)
    .maybeSingle();
  if (!p) notFound();

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif text-3xl mb-2">{p.name}</h1>
      <p className="opacity-60 text-sm mb-6">
        {p.brands?.name} · {p.tier} · {p.category} · <span className="uppercase">{p.status}</span>
      </p>

      {p.image_url && (
        <img
          src={p.image_url}
          alt={p.name}
          className="w-full max-w-md rounded-lg mb-6 border border-neutral-800"
        />
      )}

      <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm mb-8">
        <dt className="opacity-60">Slug</dt>
        <dd>{p.slug}</dd>
        <dt className="opacity-60">Price</dt>
        <dd>{p.price_amount ? `${p.price_currency} ${Number(p.price_amount).toLocaleString()}` : "—"}</dd>
        <dt className="opacity-60">Source URL</dt>
        <dd>
          {p.source_url ? (
            <a href={p.source_url} target="_blank" className="underline">
              {p.source_url}
            </a>
          ) : (
            "—"
          )}
        </dd>
        <dt className="opacity-60">Embedding</dt>
        <dd>{p.embedding ? "present (1536-dim)" : "none"}</dd>
      </dl>

      <div className="flex gap-2">
        {p.status !== "published" && (
          <form action={publishProduct.bind(null, p.id)}>
            <button className="rounded-md bg-white text-neutral-900 px-4 py-2 text-sm">Publish</button>
          </form>
        )}
        {p.status !== "archived" && (
          <form action={archiveProduct.bind(null, p.id)}>
            <button className="rounded-md bg-neutral-800 px-4 py-2 text-sm">Archive</button>
          </form>
        )}
        <form
          action={async () => {
            "use server";
            await deleteProduct(p.id);
          }}
        >
          <button className="rounded-md bg-red-900/40 text-red-300 px-4 py-2 text-sm">Delete</button>
        </form>
      </div>
    </div>
  );
}
