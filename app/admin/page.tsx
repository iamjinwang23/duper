import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const supabase = adminClient();
  const [{ count: productsCount }, { count: matchesCount }] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("matches").select("*", { count: "exact", head: true }),
  ]);

  return (
    <div>
      <h1 className="font-serif text-3xl mb-8">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className="rounded-lg border border-neutral-800 p-6">
          <div className="text-xs opacity-60 uppercase">Products</div>
          <div className="text-3xl font-serif mt-2">{productsCount ?? 0}</div>
        </div>
        <div className="rounded-lg border border-neutral-800 p-6">
          <div className="text-xs opacity-60 uppercase">Matches</div>
          <div className="text-3xl font-serif mt-2">{matchesCount ?? 0}</div>
        </div>
      </div>
    </div>
  );
}
