"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { buildMatchRows } from "@/lib/matching/rows";
import type { MatchPick } from "@/lib/matching/types";
import type { Database } from "@/lib/supabase/database.types";

type MatchInsert = Database["public"]["Tables"]["matches"]["Insert"];

export type ConfirmState = { ok?: boolean; error?: string };

export async function confirmMatches(
  luxId: string,
  picks: MatchPick[],
): Promise<ConfirmState> {
  const session = await auth();
  if (!session?.user?.email) return { error: "인증이 필요합니다." };
  if (picks.length === 0) return { error: "선택된 듀프가 없습니다." };

  const supabase = adminClient();
  // Note: the upsert + publish below are two statements, not one transaction
  // (the Supabase JS client can't span them without an RPC). Both are idempotent
  // — upsert on (lux_id,dupe_id), publish via .in() — so if the second fails the
  // admin can simply retry and the state heals. Acceptable for this low-frequency
  // admin curation flow.
  // buildMatchRows always sets a numeric `score` (from MatchPick.score), but the
  // shared MatchRow type widens it to `number | null`. The generated `matches`
  // Insert type requires a non-null score, so narrow to MatchInsert[] here —
  // this is a type-only reconciliation; runtime values are unchanged.
  const rows = buildMatchRows(luxId, picks) as MatchInsert[];

  const { error: upErr } = await supabase
    .from("matches")
    .upsert(rows, { onConflict: "lux_id,dupe_id" });
  if (upErr) return { error: upErr.message };

  // Publish the luxury product and each picked SPA product.
  const publishedAt = new Date().toISOString();
  const idsToPublish = [luxId, ...picks.map((p) => p.dupeId)];
  const { error: pubErr } = await supabase
    .from("products")
    .update({ status: "published", published_at: publishedAt })
    .in("id", idsToPublish);
  if (pubErr) return { error: pubErr.message };

  revalidatePath("/admin/match");
  revalidatePath("/");
  revalidatePath(`/admin/match/${luxId}`);

  return { ok: true };
}
