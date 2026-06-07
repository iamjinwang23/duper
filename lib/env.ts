import { z } from "zod";

const EnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  OPENAI_API_KEY: z.string().min(20).optional(),
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(20).optional(),
  GOOGLE_CLIENT_ID: z.string().min(10).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(10).optional(),
  ADMIN_EMAILS: z.string().default(""),
  // Embeddings provider. "none" disables embedding generation entirely
  // (products are saved without a vector, to be backfilled later).
  EMBEDDING_PROVIDER: z.enum(["openai", "minimax", "none"]).default("openai"),
  MINIMAX_API_KEY: z.string().optional(),
  MINIMAX_GROUP_ID: z.string().optional(),
});

export const env = EnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "http://localhost:3000",
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  ADMIN_EMAILS: process.env.ADMIN_EMAILS ?? "",
  EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER || undefined,
  MINIMAX_API_KEY: process.env.MINIMAX_API_KEY,
  MINIMAX_GROUP_ID: process.env.MINIMAX_GROUP_ID,
});

export const adminEmails = env.ADMIN_EMAILS.split(",").map((e) => e.trim()).filter(Boolean);
