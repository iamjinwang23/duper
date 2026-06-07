"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createProductFromScrape } from "@/lib/products/create";

export type BatchState = {
  created?: number;
  failures?: { url: string; error: string }[];
  error?: string;
};

export async function batchRegisterProducts(formData: FormData): Promise<BatchState> {
  const session = await auth();
  if (!session?.user?.email) return { error: "Not authenticated" };

  const brandId = String(formData.get("brand_id") ?? "");
  const tier = String(formData.get("tier") ?? "spa");
  const category = String(formData.get("category") ?? "");
  const rawUrls = String(formData.get("urls") ?? "");

  if (!brandId) return { error: "브랜드를 선택하세요." };
  if (!category) return { error: "카테고리를 선택하세요." };
  if (tier !== "luxury" && tier !== "spa") return { error: "잘못된 tier 값입니다." };
  if (category !== "bags" && category !== "shoes" && category !== "outerwear") {
    return { error: "잘못된 카테고리 값입니다." };
  }

  const urls = rawUrls
    .split(/\r?\n/)
    .map((u) => u.trim())
    .filter(Boolean);

  if (urls.length === 0) return { error: "URL을 1개 이상 입력하세요." };

  let created = 0;
  const failures: { url: string; error: string }[] = [];

  // Sequential so per-URL failures are non-fatal and we don't hammer source
  // sites with parallel requests.
  for (const url of urls) {
    const res = await createProductFromScrape({ url, brandId, tier, category });
    if (res.ok) {
      created += 1;
    } else {
      failures.push({ url: res.url, error: res.error });
    }
  }

  revalidatePath("/admin/products");

  return { created, failures };
}
