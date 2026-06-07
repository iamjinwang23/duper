export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      affiliate_links: {
        Row: {
          click_count: number
          created_at: string
          id: string
          is_active: boolean
          network: string
          product_id: string
          url: string
        }
        Insert: {
          click_count?: number
          created_at?: string
          id?: string
          is_active?: boolean
          network: string
          product_id: string
          url: string
        }
        Update: {
          click_count?: number
          created_at?: string
          id?: string
          is_active?: boolean
          network?: string
          product_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          country: string | null
          created_at: string
          id: string
          name: string
          slug: string
          tier: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: string
          name: string
          slug: string
          tier: string
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          name?: string
          slug?: string
          tier?: string
        }
        Relationships: []
      }
      click_events: {
        Row: {
          affiliate_link_id: string
          created_at: string
          id: number
          ip_hash: string | null
          referer: string | null
          session_id: string | null
          user_agent: string | null
        }
        Insert: {
          affiliate_link_id: string
          created_at?: string
          id?: number
          ip_hash?: string | null
          referer?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Update: {
          affiliate_link_id?: string
          created_at?: string
          id?: number
          ip_hash?: string | null
          referer?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "click_events_affiliate_link_id_fkey"
            columns: ["affiliate_link_id"]
            isOneToOne: false
            referencedRelation: "affiliate_links"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          body_markdown: string | null
          cover_image_url: string | null
          created_at: string
          id: string
          locale: string
          product_ids: string[]
          published_at: string | null
          slug: string
          title: string
        }
        Insert: {
          body_markdown?: string | null
          cover_image_url?: string | null
          created_at?: string
          id?: string
          locale?: string
          product_ids?: string[]
          published_at?: string | null
          slug: string
          title: string
        }
        Update: {
          body_markdown?: string | null
          cover_image_url?: string | null
          created_at?: string
          id?: string
          locale?: string
          product_ids?: string[]
          published_at?: string | null
          slug?: string
          title?: string
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string
          product_id: string
          session_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          session_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          created_at: string
          dupe_id: string
          editor_note: string | null
          id: string
          lux_id: string
          rank: number
          score: number
          status: string
        }
        Insert: {
          created_at?: string
          dupe_id: string
          editor_note?: string | null
          id?: string
          lux_id: string
          rank?: number
          score: number
          status?: string
        }
        Update: {
          created_at?: string
          dupe_id?: string
          editor_note?: string | null
          id?: string
          lux_id?: string
          rank?: number
          score?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_dupe_id_fkey"
            columns: ["dupe_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_lux_id_fkey"
            columns: ["lux_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_translations: {
        Row: {
          description: string | null
          locale: string
          name: string
          product_id: string
        }
        Insert: {
          description?: string | null
          locale: string
          name: string
          product_id: string
        }
        Update: {
          description?: string | null
          locale?: string
          name?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_translations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand_id: string
          category: string
          created_at: string
          embedding: string | null
          id: string
          image_original_url: string | null
          image_url: string | null
          name: string
          price_amount: number | null
          price_currency: string
          published_at: string | null
          slug: string
          source_url: string | null
          status: string
          tier: string
        }
        Insert: {
          brand_id: string
          category: string
          created_at?: string
          embedding?: string | null
          id?: string
          image_original_url?: string | null
          image_url?: string | null
          name: string
          price_amount?: number | null
          price_currency?: string
          published_at?: string | null
          slug: string
          source_url?: string | null
          status?: string
          tier: string
        }
        Update: {
          brand_id?: string
          category?: string
          created_at?: string
          embedding?: string | null
          id?: string
          image_original_url?: string | null
          image_url?: string | null
          name?: string
          price_amount?: number | null
          price_currency?: string
          published_at?: string | null
          slug?: string
          source_url?: string | null
          status?: string
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_picks: {
        Row: {
          banner_image_url: string | null
          created_at: string
          id: string
          locale: string
          product_ids: string[]
          published_at: string | null
          slug: string
          title: string
        }
        Insert: {
          banner_image_url?: string | null
          created_at?: string
          id?: string
          locale?: string
          product_ids?: string[]
          published_at?: string | null
          slug: string
          title: string
        }
        Update: {
          banner_image_url?: string | null
          created_at?: string
          id?: string
          locale?: string
          product_ids?: string[]
          published_at?: string | null
          slug?: string
          title?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
