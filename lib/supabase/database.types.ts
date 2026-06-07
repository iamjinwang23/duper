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
      match_spa_candidates_for: {
        Args: { lux_id: string; match_limit?: number }
        Returns: {
          id: string
          image_url: string
          name: string
          price_amount: number
          price_currency: string
          similarity: number
          slug: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
