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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ad_creatives: {
        Row: {
          campaign_id: string | null
          content: Json
          created_at: string | null
          cta_text: string | null
          cta_url: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          type: string
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          campaign_id?: string | null
          content: Json
          created_at?: string | null
          cta_text?: string | null
          cta_url?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          type: string
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          campaign_id?: string | null
          content?: Json
          created_at?: string | null
          cta_text?: string | null
          cta_url?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          type?: string
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_creatives_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      advertisers: {
        Row: {
          active_campaigns: number | null
          billing_info: Json | null
          company_name: string | null
          created_at: string | null
          id: string
          industry: string | null
          total_spent: number | null
          updated_at: string | null
          user_id: string | null
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
          website: string | null
        }
        Insert: {
          active_campaigns?: number | null
          billing_info?: Json | null
          company_name?: string | null
          created_at?: string | null
          id?: string
          industry?: string | null
          total_spent?: number | null
          updated_at?: string | null
          user_id?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          website?: string | null
        }
        Update: {
          active_campaigns?: number | null
          billing_info?: Json | null
          company_name?: string | null
          created_at?: string | null
          id?: string
          industry?: string | null
          total_spent?: number | null
          updated_at?: string | null
          user_id?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advertisers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          advertiser_id: string | null
          audience_spec: Json | null
          blockchain_tx_hash: string | null
          budget: number | null
          clicks: number | null
          conversions: number | null
          created_at: string | null
          creative_manifest: Json | null
          ctr: number | null
          currency: string | null
          delivery_constraints: Json | null
          description: string | null
          end_date: string | null
          id: string
          impressions: number | null
          name: string
          payout_rules: Json | null
          spent: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["campaign_status"] | null
          updated_at: string | null
        }
        Insert: {
          advertiser_id?: string | null
          audience_spec?: Json | null
          blockchain_tx_hash?: string | null
          budget?: number | null
          clicks?: number | null
          conversions?: number | null
          created_at?: string | null
          creative_manifest?: Json | null
          ctr?: number | null
          currency?: string | null
          delivery_constraints?: Json | null
          description?: string | null
          end_date?: string | null
          id?: string
          impressions?: number | null
          name: string
          payout_rules?: Json | null
          spent?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["campaign_status"] | null
          updated_at?: string | null
        }
        Update: {
          advertiser_id?: string | null
          audience_spec?: Json | null
          blockchain_tx_hash?: string | null
          budget?: number | null
          clicks?: number | null
          conversions?: number | null
          created_at?: string | null
          creative_manifest?: Json | null
          ctr?: number | null
          currency?: string | null
          delivery_constraints?: Json | null
          description?: string | null
          end_date?: string | null
          id?: string
          impressions?: number | null
          name?: string
          payout_rules?: Json | null
          spent?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["campaign_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          blockchain_tx_hash: string | null
          campaign_id: string | null
          granted_at: string | null
          id: string
          ipfs_hash: string | null
          is_active: boolean | null
          revoked_at: string | null
          scope: string
          signature: string | null
          user_id: string | null
        }
        Insert: {
          blockchain_tx_hash?: string | null
          campaign_id?: string | null
          granted_at?: string | null
          id?: string
          ipfs_hash?: string | null
          is_active?: boolean | null
          revoked_at?: string | null
          scope: string
          signature?: string | null
          user_id?: string | null
        }
        Update: {
          blockchain_tx_hash?: string | null
          campaign_id?: string | null
          granted_at?: string | null
          id?: string
          ipfs_hash?: string | null
          is_active?: boolean | null
          revoked_at?: string | null
          scope?: string
          signature?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consents_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          ad_id: string | null
          blockchain_tx_hash: string | null
          campaign_id: string | null
          id: string
          ipfs_hash: string | null
          metadata: Json | null
          publisher_id: string | null
          reward_amount: number | null
          signature: string | null
          slot_id: string | null
          timestamp: string | null
          type: Database["public"]["Enums"]["event_type"]
          user_id: string | null
        }
        Insert: {
          ad_id?: string | null
          blockchain_tx_hash?: string | null
          campaign_id?: string | null
          id?: string
          ipfs_hash?: string | null
          metadata?: Json | null
          publisher_id?: string | null
          reward_amount?: number | null
          signature?: string | null
          slot_id?: string | null
          timestamp?: string | null
          type: Database["public"]["Enums"]["event_type"]
          user_id?: string | null
        }
        Update: {
          ad_id?: string | null
          blockchain_tx_hash?: string | null
          campaign_id?: string | null
          id?: string
          ipfs_hash?: string | null
          metadata?: Json | null
          publisher_id?: string | null
          reward_amount?: number | null
          signature?: string | null
          slot_id?: string | null
          timestamp?: string | null
          type?: Database["public"]["Enums"]["event_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "publishers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          consents: Json | null
          created_at: string | null
          did: string | null
          display_name: string | null
          email: string
          id: string
          interests: string[] | null
          pds_url: string | null
          reward_preferences: Json | null
          role: Database["public"]["Enums"]["user_role"] | null
          token_balance: number | null
          updated_at: string | null
          wallet_address: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          consents?: Json | null
          created_at?: string | null
          did?: string | null
          display_name?: string | null
          email: string
          id: string
          interests?: string[] | null
          pds_url?: string | null
          reward_preferences?: Json | null
          role?: Database["public"]["Enums"]["user_role"] | null
          token_balance?: number | null
          updated_at?: string | null
          wallet_address?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          consents?: Json | null
          created_at?: string | null
          did?: string | null
          display_name?: string | null
          email?: string
          id?: string
          interests?: string[] | null
          pds_url?: string | null
          reward_preferences?: Json | null
          role?: Database["public"]["Enums"]["user_role"] | null
          token_balance?: number | null
          updated_at?: string | null
          wallet_address?: string | null
        }
        Relationships: []
      }
      publishers: {
        Row: {
          ad_slots: Json | null
          api_key: string | null
          categories: string[] | null
          created_at: string | null
          description: string | null
          domain: string | null
          id: string
          name: string
          payout_preferences: Json | null
          status: string | null
          total_clicks: number | null
          total_earnings: number | null
          total_impressions: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ad_slots?: Json | null
          api_key?: string | null
          categories?: string[] | null
          created_at?: string | null
          description?: string | null
          domain?: string | null
          id?: string
          name: string
          payout_preferences?: Json | null
          status?: string | null
          total_clicks?: number | null
          total_earnings?: number | null
          total_impressions?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ad_slots?: Json | null
          api_key?: string | null
          categories?: string[] | null
          created_at?: string | null
          description?: string | null
          domain?: string | null
          id?: string
          name?: string
          payout_preferences?: Json | null
          status?: string | null
          total_clicks?: number | null
          total_earnings?: number | null
          total_impressions?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publishers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          blockchain_tx_hash: string | null
          campaign_id: string | null
          created_at: string | null
          currency: string | null
          from_user_id: string | null
          id: string
          metadata: Json | null
          status: Database["public"]["Enums"]["transaction_status"] | null
          stripe_payment_id: string | null
          to_user_id: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          blockchain_tx_hash?: string | null
          campaign_id?: string | null
          created_at?: string | null
          currency?: string | null
          from_user_id?: string | null
          id?: string
          metadata?: Json | null
          status?: Database["public"]["Enums"]["transaction_status"] | null
          stripe_payment_id?: string | null
          to_user_id?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          blockchain_tx_hash?: string | null
          campaign_id?: string | null
          created_at?: string | null
          currency?: string | null
          from_user_id?: string | null
          id?: string
          metadata?: Json | null
          status?: Database["public"]["Enums"]["transaction_status"] | null
          stripe_payment_id?: string | null
          to_user_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_rewards: {
        Row: {
          amount: number
          blockchain_tx_hash: string | null
          campaign_id: string | null
          created_at: string | null
          event_id: string | null
          id: string
          paid_at: string | null
          reward_type: string
          status: Database["public"]["Enums"]["transaction_status"] | null
          user_id: string | null
        }
        Insert: {
          amount: number
          blockchain_tx_hash?: string | null
          campaign_id?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          paid_at?: string | null
          reward_type: string
          status?: Database["public"]["Enums"]["transaction_status"] | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          blockchain_tx_hash?: string | null
          campaign_id?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          paid_at?: string | null
          reward_type?: string
          status?: Database["public"]["Enums"]["transaction_status"] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_rewards_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_rewards_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_rewards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      campaign_status:
        | "draft"
        | "pending"
        | "active"
        | "paused"
        | "completed"
        | "rejected"
      event_type: "impression" | "click" | "conversion" | "view"
      transaction_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "refunded"
      user_role: "user" | "advertiser" | "publisher" | "admin"
      verification_status: "pending" | "verified" | "rejected"
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
    Enums: {
      campaign_status: [
        "draft",
        "pending",
        "active",
        "paused",
        "completed",
        "rejected",
      ],
      event_type: ["impression", "click", "conversion", "view"],
      transaction_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "refunded",
      ],
      user_role: ["user", "advertiser", "publisher", "admin"],
      verification_status: ["pending", "verified", "rejected"],
    },
  },
} as const

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type UserRole = Database['public']['Enums']['user_role'];
