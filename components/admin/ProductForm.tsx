"use client";

import { useState, useTransition } from "react";
import { registerProduct, prefillFromUrl } from "@/app/admin/products/actions";

type Brand = { id: string; name: string; tier: string };

export function ProductForm({ brands }: { brands: Brand[] }) {
  const [isPending, startTransition] = useTransition();
  const [scraping, startScrape] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<Awaited<ReturnType<typeof prefillFromUrl>> | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");

  function handleScrape() {
    if (!sourceUrl) return;
    startScrape(async () => {
      try {
        const meta = await prefillFromUrl(sourceUrl);
        setPrefill(meta);
      } catch (e) {
        alert(`Scrape failed: ${(e as Error).message}`);
      }
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      // On success the server action calls redirect() and the router navigates;
      // on failure it returns { error }.
      const res = await registerProduct(formData);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      <div>
        <label className="block text-xs uppercase opacity-60 mb-1">Source URL (optional)</label>
        <div className="flex gap-2">
          <input
            name="source_url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            className="flex-1 rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2"
            placeholder="https://www.ysl.com/..."
          />
          <button
            type="button"
            onClick={handleScrape}
            disabled={scraping || !sourceUrl}
            className="rounded-md bg-neutral-800 px-4 text-sm"
          >
            {scraping ? "Fetching..." : "Fetch"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase opacity-60 mb-1">Brand</label>
          <select
            name="brand_id"
            required
            className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2"
          >
            <option value="">Select brand...</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.tier})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase opacity-60 mb-1">Tier</label>
          <select name="tier" required className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2">
            <option value="luxury">Luxury</option>
            <option value="spa">SPA</option>
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase opacity-60 mb-1">Category</label>
          <select name="category" required className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2">
            <option value="bags">Bags</option>
            <option value="shoes">Shoes</option>
            <option value="outerwear">Outerwear</option>
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase opacity-60 mb-1">Currency</label>
          <select name="price_currency" defaultValue="KRW" className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2">
            <option value="KRW">KRW</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs uppercase opacity-60 mb-1">Name</label>
        <input
          name="name"
          required
          defaultValue={prefill?.title ?? ""}
          key={`name-${prefill?.title ?? ""}`}
          className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-xs uppercase opacity-60 mb-1">Description</label>
        <textarea
          name="description"
          rows={3}
          defaultValue={prefill?.description ?? ""}
          key={`desc-${prefill?.description ?? ""}`}
          className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase opacity-60 mb-1">Price</label>
          <input
            name="price_amount"
            type="number"
            step="0.01"
            defaultValue={prefill?.priceAmount ?? ""}
            key={`price-${prefill?.priceAmount ?? ""}`}
            className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-xs uppercase opacity-60 mb-1">Image URL</label>
          <input
            name="image_original_url"
            type="url"
            defaultValue={prefill?.imageUrl ?? ""}
            key={`img-${prefill?.imageUrl ?? ""}`}
            className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-white text-neutral-900 px-6 py-2 font-medium"
      >
        {isPending ? "Saving..." : "Register product"}
      </button>
    </form>
  );
}
