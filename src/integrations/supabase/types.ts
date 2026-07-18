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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      economy_accounts: {
        Row: {
          coins: number
          initialized_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          coins?: number
          initialized_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          coins?: number
          initialized_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gridiron_cash_accounts: {
        Row: {
          balance: number
          total_purchased: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          total_purchased?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          total_purchased?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gridiron_cash_ledger: {
        Row: {
          balance_after: number
          created_at: string
          delta: number
          id: string
          purchase_id: string | null
          reason: string
          reference: string | null
          user_id: string
        }
        Insert: {
          balance_after: number
          created_at?: string
          delta: number
          id?: string
          purchase_id?: string | null
          reason: string
          reference?: string | null
          user_id: string
        }
        Update: {
          balance_after?: number
          created_at?: string
          delta?: number
          id?: string
          purchase_id?: string | null
          reason?: string
          reference?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gridiron_cash_ledger_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: true
            referencedRelation: "gridiron_cash_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      gridiron_cash_purchases: {
        Row: {
          created_at: string
          current_pool_lamports: number
          development_lamports: number
          expected_lamports: number
          expires_at: string
          failure_reason: string | null
          finalized_at: string | null
          gc_amount: number
          id: string
          next_pool_lamports: number
          signature: string | null
          status: string
          user_id: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          current_pool_lamports?: number
          development_lamports?: number
          expected_lamports: number
          expires_at?: string
          failure_reason?: string | null
          finalized_at?: string | null
          gc_amount: number
          id?: string
          next_pool_lamports?: number
          signature?: string | null
          status?: string
          user_id: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          current_pool_lamports?: number
          development_lamports?: number
          expected_lamports?: number
          expires_at?: string
          failure_reason?: string | null
          finalized_at?: string | null
          gc_amount?: number
          id?: string
          next_pool_lamports?: number
          signature?: string | null
          status?: string
          user_id?: string
          wallet_address?: string
        }
        Relationships: []
      }
      market_bids: {
        Row: {
          amount: number
          bidder_id: string
          created_at: string
          id: string
          listing_id: string
        }
        Insert: {
          amount: number
          bidder_id: string
          created_at?: string
          id?: string
          listing_id: string
        }
        Update: {
          amount?: number
          bidder_id?: string
          created_at?: string
          id?: string
          listing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_bids_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "market_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      market_cards: {
        Row: {
          card_data: Json
          card_id: string
          owner_id: string
          status: string
          updated_at: string
        }
        Insert: {
          card_data: Json
          card_id: string
          owner_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          card_data?: Json
          card_id?: string
          owner_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      market_listings: {
        Row: {
          buy_now_price: number | null
          card_data: Json
          card_id: string
          completed_at: string | null
          created_at: string
          currency: string
          current_bid: number | null
          expires_at: string
          high_bidder_id: string | null
          id: string
          sale_type: string
          seller_id: string
          seller_wallet: string | null
          sol_lamports: number | null
          starting_price: number | null
          status: string
        }
        Insert: {
          buy_now_price?: number | null
          card_data: Json
          card_id: string
          completed_at?: string | null
          created_at?: string
          currency: string
          current_bid?: number | null
          expires_at?: string
          high_bidder_id?: string | null
          id?: string
          sale_type: string
          seller_id: string
          seller_wallet?: string | null
          sol_lamports?: number | null
          starting_price?: number | null
          status?: string
        }
        Update: {
          buy_now_price?: number | null
          card_data?: Json
          card_id?: string
          completed_at?: string | null
          created_at?: string
          currency?: string
          current_bid?: number | null
          expires_at?: string
          high_bidder_id?: string | null
          id?: string
          sale_type?: string
          seller_id?: string
          seller_wallet?: string | null
          sol_lamports?: number | null
          starting_price?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_listings_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "market_cards"
            referencedColumns: ["card_id"]
          },
        ]
      }
      market_sol_purchases: {
        Row: {
          buyer_id: string
          buyer_wallet: string
          created_at: string
          expected_lamports: number
          expires_at: string
          finalized_at: string | null
          id: string
          listing_id: string
          seller_wallet: string
          signature: string | null
          status: string
        }
        Insert: {
          buyer_id: string
          buyer_wallet: string
          created_at?: string
          expected_lamports: number
          expires_at?: string
          finalized_at?: string | null
          id?: string
          listing_id: string
          seller_wallet: string
          signature?: string | null
          status?: string
        }
        Update: {
          buyer_id?: string
          buyer_wallet?: string
          created_at?: string
          expected_lamports?: number
          expires_at?: string
          finalized_at?: string | null
          id?: string
          listing_id?: string
          seller_wallet?: string
          signature?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_sol_purchases_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "market_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_allocation: {
        Row: {
          current_pool_lamports: number
          development_lamports: number
          next_pool_lamports: number
          singleton: boolean
          updated_at: string
        }
        Insert: {
          current_pool_lamports?: number
          development_lamports?: number
          next_pool_lamports?: number
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          current_pool_lamports?: number
          development_lamports?: number
          next_pool_lamports?: number
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_market_account: {
        Args: { p_starting_coins: number }
        Returns: number
      }
      buy_market_listing_coins: {
        Args: { p_listing_id: string }
        Returns: {
          balance: number
          card_data: Json
        }[]
      }
      cancel_market_listing: { Args: { p_listing_id: string }; Returns: Json }
      create_market_listing: {
        Args: {
          p_buy_now_price?: number
          p_card_data: Json
          p_currency: string
          p_duration_hours?: number
          p_sale_type: string
          p_seller_wallet?: string
          p_sol_lamports?: number
          p_starting_price?: number
        }
        Returns: {
          buy_now_price: number | null
          card_data: Json
          card_id: string
          completed_at: string | null
          created_at: string
          currency: string
          current_bid: number | null
          expires_at: string
          high_bidder_id: string | null
          id: string
          sale_type: string
          seller_id: string
          seller_wallet: string | null
          sol_lamports: number | null
          starting_price: number | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "market_listings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finalize_gridiron_cash_purchase: {
        Args: { p_purchase_id: string; p_signature: string; p_user_id: string }
        Returns: {
          balance: number
          current_pool_lamports: number
          development_lamports: number
          expected_lamports: number
          finalized_at: string
          gc_amount: number
          next_pool_lamports: number
        }[]
      }
      finalize_market_sol_purchase: {
        Args: { p_buyer_id: string; p_purchase_id: string; p_signature: string }
        Returns: Json
      }
      place_market_bid: {
        Args: { p_amount: number; p_listing_id: string }
        Returns: {
          balance: number
          current_bid: number
        }[]
      }
      settle_expired_market_listings: { Args: never; Returns: number }
      spend_gridiron_cash: {
        Args: {
          p_amount: number
          p_reason: string
          p_reference: string
          p_user_id: string
        }
        Returns: number
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
