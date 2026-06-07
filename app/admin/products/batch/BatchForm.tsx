"use client";

import { useState, useTransition } from "react";
import { batchRegisterProducts, type BatchState } from "@/app/admin/products/batch/actions";

type Brand = { id: string; name: string; tier: string };

export function BatchForm({ brands }: { brands: Brand[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BatchState | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResult(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await batchRegisterProducts(formData);
      if (res.error) {
        setError(res.error);
      } else {
        setResult(res);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      <div className="grid grid-cols-3 gap-4">
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
          <select
            name="tier"
            defaultValue="spa"
            required
            className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2"
          >
            <option value="spa">SPA</option>
            <option value="luxury">Luxury</option>
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase opacity-60 mb-1">Category</label>
          <select
            name="category"
            required
            className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2"
          >
            <option value="">Select...</option>
            <option value="bags">Bags</option>
            <option value="shoes">Shoes</option>
            <option value="outerwear">Outerwear</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs uppercase opacity-60 mb-1">
          Product URLs (one per line)
        </label>
        <textarea
          name="urls"
          rows={10}
          required
          className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 font-mono text-sm"
          placeholder={"https://www.cos.com/...\nhttps://www2.hm.com/...\nhttps://www.zara.com/..."}
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-white text-neutral-900 px-6 py-2 font-medium"
      >
        {isPending ? "Registering..." : "Register batch"}
      </button>

      {result && (
        <div className="mt-6 space-y-3 rounded-md border border-neutral-800 p-4">
          <p className="text-sm">
            <span className="font-medium text-emerald-400">{result.created ?? 0}</span> created
            {result.failures && result.failures.length > 0 && (
              <>
                {" · "}
                <span className="font-medium text-red-400">{result.failures.length}</span> failed
              </>
            )}
          </p>
          {result.failures && result.failures.length > 0 && (
            <ul className="space-y-1 text-xs">
              {result.failures.map((f, i) => (
                <li key={`${f.url}-${i}`} className="text-red-400">
                  <span className="opacity-70 break-all">{f.url}</span> — {f.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
