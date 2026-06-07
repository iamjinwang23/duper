"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Not authenticated");
}

export async function publishProduct(id: string) {
  await requireAdmin();
  const supabase = adminClient();
  const { error } = await supabase
    .from("products")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath(`/admin/products/${id}`);
  revalidatePath("/admin/products");
}

export async function archiveProduct(id: string) {
  await requireAdmin();
  const supabase = adminClient();
  const { error } = await supabase.from("products").update({ status: "archived" }).eq("id", id);
  if (error) throw error;
  revalidatePath(`/admin/products/${id}`);
}

export async function deleteProduct(id: string) {
  await requireAdmin();
  const supabase = adminClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/admin/products");
}
