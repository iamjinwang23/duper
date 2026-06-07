"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmMatches } from "../actions";
import type { MatchSuggestion, MatchPick } from "@/lib/matching/types";

export function MatchPicker({
  luxId,
  suggestions,
}: {
  luxId: string;
  suggestions: MatchSuggestion[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  function toggle(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  function submit() {
    const picks: MatchPick[] = suggestions
      .filter((s) => selected[s.id])
      .map((s, i) => ({
        dupeId: s.id,
        rank: i + 1,
        score: s.score,
        editorNote: notes[s.id] ?? "",
      }));

    if (picks.length === 0) {
      setError("최소 1개를 선택하세요.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await confirmMatches(luxId, picks);
      if (res.error) setError(res.error);
      else router.push("/admin/match");
    });
  }

  return (
    <div>
      <ul className="flex flex-col gap-4">
        {suggestions.map((s) => (
          <li
            key={s.id}
            className="flex gap-4 items-start rounded-lg border border-neutral-800 p-4"
          >
            <input
              type="checkbox"
              checked={!!selected[s.id]}
              onChange={() => toggle(s.id)}
              className="mt-2"
            />
            {s.imageUrl && (
              <img
                src={s.imageUrl}
                alt={s.name}
                className="w-24 h-24 object-cover rounded"
              />
            )}
            <div className="flex-1">
              <div className="text-sm font-medium">{s.name}</div>
              <div className="text-xs mt-1 opacity-60">
                매치 {Math.round(s.score * 100)}% · 유사도 {Math.round(s.similarity * 100)}%
              </div>
              <div className="text-xs mt-1 opacity-50">{s.reason}</div>
              <input
                type="text"
                placeholder="에디터 코멘트 (선택)"
                value={notes[s.id] ?? ""}
                onChange={(e) =>
                  setNotes((n) => ({ ...n, [s.id]: e.target.value }))
                }
                className="mt-2 w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
              />
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="mt-4 text-red-400">{error}</p>}
      <button
        onClick={submit}
        disabled={pending}
        className="mt-6 rounded-md bg-white px-6 py-2 text-sm text-neutral-900 disabled:opacity-50"
      >
        {pending ? "발행 중..." : "선택한 듀프 발행"}
      </button>
    </div>
  );
}
