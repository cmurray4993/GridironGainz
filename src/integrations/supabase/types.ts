export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      app_release_controls: {
        Row: {
          consumer_protection_review_complete: boolean;
          financial_compliance_review_complete: boolean;
          incident_response_ready: boolean;
          jurisdiction_controls_complete: boolean;
          legal_review_complete: boolean;
          minimum_age: number;
          operator_identity_complete: boolean;
          purchase_funded_prizes: boolean;
          real_money_enabled: boolean;
          real_sol_market_enabled: boolean;
          reconciliation_ready: boolean;
          release_mode: string;
          security_review_complete: boolean;
          singleton: boolean;
          sponsor_prize_pool_lamports: number;
          tax_review_complete: boolean;
          updated_at: string;
        };
        Insert: {
          consumer_protection_review_complete?: boolean;
          financial_compliance_review_complete?: boolean;
          incident_response_ready?: boolean;
          jurisdiction_controls_complete?: boolean;
          legal_review_complete?: boolean;
          minimum_age?: number;
          operator_identity_complete?: boolean;
          purchase_funded_prizes?: boolean;
          real_money_enabled?: boolean;
          real_sol_market_enabled?: boolean;
          reconciliation_ready?: boolean;
          release_mode?: string;
          security_review_complete?: boolean;
          singleton?: boolean;
          sponsor_prize_pool_lamports?: number;
          tax_review_complete?: boolean;
          updated_at?: string;
        };
        Update: {
          consumer_protection_review_complete?: boolean;
          financial_compliance_review_complete?: boolean;
          incident_response_ready?: boolean;
          jurisdiction_controls_complete?: boolean;
          legal_review_complete?: boolean;
          minimum_age?: number;
          operator_identity_complete?: boolean;
          purchase_funded_prizes?: boolean;
          real_money_enabled?: boolean;
          real_sol_market_enabled?: boolean;
          reconciliation_ready?: boolean;
          release_mode?: string;
          security_review_complete?: boolean;
          singleton?: boolean;
          sponsor_prize_pool_lamports?: number;
          tax_review_complete?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      beta_developer_accounts: {
        Row: {
          claimed_at: string;
          disabled_at: string | null;
          enabled: boolean;
          user_id: string;
        };
        Insert: {
          claimed_at?: string;
          disabled_at?: string | null;
          enabled?: boolean;
          user_id: string;
        };
        Update: {
          claimed_at?: string;
          disabled_at?: string | null;
          enabled?: boolean;
          user_id?: string;
        };
        Relationships: [];
      };
      beta_developer_invites: {
        Row: {
          consumed_at: string | null;
          consumed_by: string | null;
          created_at: string;
          expires_at: string;
          token_sha256: string;
        };
        Insert: {
          consumed_at?: string | null;
          consumed_by?: string | null;
          created_at?: string;
          expires_at: string;
          token_sha256: string;
        };
        Update: {
          consumed_at?: string | null;
          consumed_by?: string | null;
          created_at?: string;
          expires_at?: string;
          token_sha256?: string;
        };
        Relationships: [];
      };
      currency_ledger: {
        Row: {
          balance_after: number;
          created_at: string;
          currency: string;
          delta: number;
          id: string;
          idempotency_key: string | null;
          metadata: Json;
          reason: string;
          reference_id: string | null;
          reference_type: string | null;
          user_id: string;
        };
        Insert: {
          balance_after: number;
          created_at?: string;
          currency: string;
          delta: number;
          id?: string;
          idempotency_key?: string | null;
          metadata?: Json;
          reason: string;
          reference_id?: string | null;
          reference_type?: string | null;
          user_id: string;
        };
        Update: {
          balance_after?: number;
          created_at?: string;
          currency?: string;
          delta?: number;
          id?: string;
          idempotency_key?: string | null;
          metadata?: Json;
          reason?: string;
          reference_id?: string | null;
          reference_type?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      economy_accounts: {
        Row: {
          coins: number;
          fans: number;
          initialized_at: string;
          last_claim_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          coins?: number;
          fans?: number;
          initialized_at?: string;
          last_claim_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          coins?: number;
          fans?: number;
          initialized_at?: string;
          last_claim_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      game_profiles: {
        Row: {
          created_at: string;
          level: number;
          lifetime_losses: number;
          lifetime_wins: number;
          packs_opened: number;
          starter_pack_opened: boolean;
          team_name: string;
          updated_at: string;
          user_id: string;
          xp: number;
        };
        Insert: {
          created_at?: string;
          level?: number;
          lifetime_losses?: number;
          lifetime_wins?: number;
          packs_opened?: number;
          starter_pack_opened?: boolean;
          team_name?: string;
          updated_at?: string;
          user_id: string;
          xp?: number;
        };
        Update: {
          created_at?: string;
          level?: number;
          lifetime_losses?: number;
          lifetime_wins?: number;
          packs_opened?: number;
          starter_pack_opened?: boolean;
          team_name?: string;
          updated_at?: string;
          user_id?: string;
          xp?: number;
        };
        Relationships: [];
      };
      gridiron_cash_accounts: {
        Row: {
          balance: number;
          total_purchased: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          balance?: number;
          total_purchased?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          balance?: number;
          total_purchased?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      gridiron_cash_ledger: {
        Row: {
          balance_after: number;
          created_at: string;
          delta: number;
          id: string;
          purchase_id: string | null;
          reason: string;
          reference: string | null;
          user_id: string;
        };
        Insert: {
          balance_after: number;
          created_at?: string;
          delta: number;
          id?: string;
          purchase_id?: string | null;
          reason: string;
          reference?: string | null;
          user_id: string;
        };
        Update: {
          balance_after?: number;
          created_at?: string;
          delta?: number;
          id?: string;
          purchase_id?: string | null;
          reason?: string;
          reference?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gridiron_cash_ledger_purchase_id_fkey";
            columns: ["purchase_id"];
            isOneToOne: true;
            referencedRelation: "gridiron_cash_purchases";
            referencedColumns: ["id"];
          },
        ];
      };
      gridiron_cash_purchases: {
        Row: {
          accounting_status: string;
          block_time: string | null;
          confirmed_slot: number | null;
          created_at: string;
          current_pool_lamports: number;
          development_lamports: number;
          expected_lamports: number;
          expires_at: string;
          failure_reason: string | null;
          finalized_at: string | null;
          gc_amount: number;
          id: string;
          network: string;
          next_pool_lamports: number;
          signature: string | null;
          status: string;
          transaction_fee_lamports: number | null;
          treasury_wallet: string;
          usd_fmv_cents: number | null;
          usd_price_source: string | null;
          user_id: string;
          wallet_address: string;
        };
        Insert: {
          accounting_status?: string;
          block_time?: string | null;
          confirmed_slot?: number | null;
          created_at?: string;
          current_pool_lamports?: number;
          development_lamports?: number;
          expected_lamports: number;
          expires_at?: string;
          failure_reason?: string | null;
          finalized_at?: string | null;
          gc_amount: number;
          id?: string;
          network?: string;
          next_pool_lamports?: number;
          signature?: string | null;
          status?: string;
          transaction_fee_lamports?: number | null;
          treasury_wallet: string;
          usd_fmv_cents?: number | null;
          usd_price_source?: string | null;
          user_id: string;
          wallet_address: string;
        };
        Update: {
          accounting_status?: string;
          block_time?: string | null;
          confirmed_slot?: number | null;
          created_at?: string;
          current_pool_lamports?: number;
          development_lamports?: number;
          expected_lamports?: number;
          expires_at?: string;
          failure_reason?: string | null;
          finalized_at?: string | null;
          gc_amount?: number;
          id?: string;
          network?: string;
          next_pool_lamports?: number;
          signature?: string | null;
          status?: string;
          transaction_fee_lamports?: number | null;
          treasury_wallet?: string;
          usd_fmv_cents?: number | null;
          usd_price_source?: string | null;
          user_id?: string;
          wallet_address?: string;
        };
        Relationships: [];
      };
      league_teams: {
        Row: {
          bot_overall: number;
          eliminated: boolean;
          final_rank: number | null;
          id: string;
          league_id: string;
          losses: number;
          name: string;
          playoff_seed: number | null;
          points_against: number;
          points_for: number;
          seat: number;
          user_id: string | null;
          wins: number;
        };
        Insert: {
          bot_overall?: number;
          eliminated?: boolean;
          final_rank?: number | null;
          id?: string;
          league_id: string;
          losses?: number;
          name: string;
          playoff_seed?: number | null;
          points_against?: number;
          points_for?: number;
          seat: number;
          user_id?: string | null;
          wins?: number;
        };
        Update: {
          bot_overall?: number;
          eliminated?: boolean;
          final_rank?: number | null;
          id?: string;
          league_id?: string;
          losses?: number;
          name?: string;
          playoff_seed?: number | null;
          points_against?: number;
          points_for?: number;
          seat?: number;
          user_id?: string | null;
          wins?: number;
        };
        Relationships: [
          {
            foreignKeyName: "league_teams_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "season_leagues";
            referencedColumns: ["id"];
          },
        ];
      };
      legal_acceptances: {
        Row: {
          accepted_at: string;
          age_of_majority_attested: boolean;
          contest_rules_version: string;
          country_code: string;
          id: string;
          ip_sha256: string | null;
          privacy_version: string;
          purchase_policy_version: string;
          revoked_at: string | null;
          terms_version: string;
          user_agent_sha256: string | null;
          user_id: string;
        };
        Insert: {
          accepted_at?: string;
          age_of_majority_attested: boolean;
          contest_rules_version: string;
          country_code: string;
          id?: string;
          ip_sha256?: string | null;
          privacy_version: string;
          purchase_policy_version: string;
          revoked_at?: string | null;
          terms_version: string;
          user_agent_sha256?: string | null;
          user_id: string;
        };
        Update: {
          accepted_at?: string;
          age_of_majority_attested?: boolean;
          contest_rules_version?: string;
          country_code?: string;
          id?: string;
          ip_sha256?: string | null;
          privacy_version?: string;
          purchase_policy_version?: string;
          revoked_at?: string | null;
          terms_version?: string;
          user_agent_sha256?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      legal_documents: {
        Row: {
          code: string;
          content_sha256: string | null;
          created_at: string;
          document_path: string;
          effective_at: string;
          is_current: boolean;
          version: string;
        };
        Insert: {
          code: string;
          content_sha256?: string | null;
          created_at?: string;
          document_path: string;
          effective_at: string;
          is_current?: boolean;
          version: string;
        };
        Update: {
          code?: string;
          content_sha256?: string | null;
          created_at?: string;
          document_path?: string;
          effective_at?: string;
          is_current?: boolean;
          version?: string;
        };
        Relationships: [];
      };
      market_bids: {
        Row: {
          amount: number;
          bidder_id: string;
          created_at: string;
          id: string;
          listing_id: string;
        };
        Insert: {
          amount: number;
          bidder_id: string;
          created_at?: string;
          id?: string;
          listing_id: string;
        };
        Update: {
          amount?: number;
          bidder_id?: string;
          created_at?: string;
          id?: string;
          listing_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "market_bids_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "market_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      market_cards: {
        Row: {
          authoritative_card_id: string | null;
          card_data: Json;
          card_id: string;
          owner_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          authoritative_card_id?: string | null;
          card_data: Json;
          card_id: string;
          owner_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          authoritative_card_id?: string | null;
          card_data?: Json;
          card_id?: string;
          owner_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "market_cards_authoritative_card_id_fkey";
            columns: ["authoritative_card_id"];
            isOneToOne: true;
            referencedRelation: "player_cards";
            referencedColumns: ["id"];
          },
        ];
      };
      market_listings: {
        Row: {
          buy_now_price: number | null;
          buyer_id: string | null;
          card_data: Json;
          card_id: string;
          completed_at: string | null;
          created_at: string;
          currency: string;
          current_bid: number | null;
          expires_at: string;
          high_bidder_id: string | null;
          id: string;
          sale_type: string;
          seller_id: string;
          seller_wallet: string | null;
          sol_lamports: number | null;
          starting_price: number | null;
          status: string;
        };
        Insert: {
          buy_now_price?: number | null;
          buyer_id?: string | null;
          card_data: Json;
          card_id: string;
          completed_at?: string | null;
          created_at?: string;
          currency: string;
          current_bid?: number | null;
          expires_at?: string;
          high_bidder_id?: string | null;
          id?: string;
          sale_type: string;
          seller_id: string;
          seller_wallet?: string | null;
          sol_lamports?: number | null;
          starting_price?: number | null;
          status?: string;
        };
        Update: {
          buy_now_price?: number | null;
          buyer_id?: string | null;
          card_data?: Json;
          card_id?: string;
          completed_at?: string | null;
          created_at?: string;
          currency?: string;
          current_bid?: number | null;
          expires_at?: string;
          high_bidder_id?: string | null;
          id?: string;
          sale_type?: string;
          seller_id?: string;
          seller_wallet?: string | null;
          sol_lamports?: number | null;
          starting_price?: number | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "market_listings_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "market_cards";
            referencedColumns: ["card_id"];
          },
        ];
      };
      market_sol_purchases: {
        Row: {
          block_time: string | null;
          buyer_id: string;
          buyer_wallet: string;
          confirmed_slot: number | null;
          created_at: string;
          expected_lamports: number;
          expires_at: string;
          finalized_at: string | null;
          id: string;
          listing_id: string;
          network: string;
          reconciliation_status: string;
          seller_wallet: string;
          signature: string | null;
          status: string;
          transaction_fee_lamports: number | null;
        };
        Insert: {
          block_time?: string | null;
          buyer_id: string;
          buyer_wallet: string;
          confirmed_slot?: number | null;
          created_at?: string;
          expected_lamports: number;
          expires_at?: string;
          finalized_at?: string | null;
          id?: string;
          listing_id: string;
          network?: string;
          reconciliation_status?: string;
          seller_wallet: string;
          signature?: string | null;
          status?: string;
          transaction_fee_lamports?: number | null;
        };
        Update: {
          block_time?: string | null;
          buyer_id?: string;
          buyer_wallet?: string;
          confirmed_slot?: number | null;
          created_at?: string;
          expected_lamports?: number;
          expires_at?: string;
          finalized_at?: string | null;
          id?: string;
          listing_id?: string;
          network?: string;
          reconciliation_status?: string;
          seller_wallet?: string;
          signature?: string | null;
          status?: string;
          transaction_fee_lamports?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "market_sol_purchases_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "market_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      pack_definitions: {
        Row: {
          active: boolean;
          card_count: number;
          code: string;
          coin_cost: number | null;
          display_name: string;
          gc_cost: number | null;
          odds: Json;
          published_at: string;
          version: number;
        };
        Insert: {
          active?: boolean;
          card_count: number;
          code: string;
          coin_cost?: number | null;
          display_name: string;
          gc_cost?: number | null;
          odds: Json;
          published_at?: string;
          version: number;
        };
        Update: {
          active?: boolean;
          card_count?: number;
          code?: string;
          coin_cost?: number | null;
          display_name?: string;
          gc_cost?: number | null;
          odds?: Json;
          published_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      pack_opening_cards: {
        Row: {
          card_id: string;
          opening_id: string;
          slot_number: number;
        };
        Insert: {
          card_id: string;
          opening_id: string;
          slot_number: number;
        };
        Update: {
          card_id?: string;
          opening_id?: string;
          slot_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "pack_opening_cards_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: true;
            referencedRelation: "player_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pack_opening_cards_opening_id_fkey";
            columns: ["opening_id"];
            isOneToOne: false;
            referencedRelation: "pack_openings";
            referencedColumns: ["id"];
          },
        ];
      };
      pack_openings: {
        Row: {
          cost: number;
          created_at: string;
          currency: string;
          id: string;
          odds_snapshot: Json;
          pack_code: string;
          pack_version: number;
          request_id: string;
          selected_position: string | null;
          status: string;
          user_id: string;
        };
        Insert: {
          cost: number;
          created_at?: string;
          currency: string;
          id?: string;
          odds_snapshot: Json;
          pack_code: string;
          pack_version: number;
          request_id: string;
          selected_position?: string | null;
          status?: string;
          user_id: string;
        };
        Update: {
          cost?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          odds_snapshot?: Json;
          pack_code?: string;
          pack_version?: number;
          request_id?: string;
          selected_position?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pack_openings_pack_code_fkey";
            columns: ["pack_code"];
            isOneToOne: false;
            referencedRelation: "pack_definitions";
            referencedColumns: ["code"];
          },
        ];
      };
      player_cards: {
        Row: {
          acquired_at: string;
          fan_value: number;
          id: string;
          iq: number;
          name: string;
          overall: number;
          owner_id: string;
          pack_opening_id: string | null;
          popularity: number;
          position: string;
          program: string;
          rarity: string;
          signature_key: string;
          signature_label: string;
          signature_value: number;
          speed: number;
          status: string;
          strength: number;
          updated_at: string;
        };
        Insert: {
          acquired_at?: string;
          fan_value: number;
          id?: string;
          iq: number;
          name: string;
          overall: number;
          owner_id: string;
          pack_opening_id?: string | null;
          popularity: number;
          position: string;
          program?: string;
          rarity: string;
          signature_key: string;
          signature_label: string;
          signature_value: number;
          speed: number;
          status?: string;
          strength: number;
          updated_at?: string;
        };
        Update: {
          acquired_at?: string;
          fan_value?: number;
          id?: string;
          iq?: number;
          name?: string;
          overall?: number;
          owner_id?: string;
          pack_opening_id?: string | null;
          popularity?: number;
          position?: string;
          program?: string;
          rarity?: string;
          signature_key?: string;
          signature_label?: string;
          signature_value?: number;
          speed?: number;
          status?: string;
          strength?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_cards_pack_opening_id_fkey";
            columns: ["pack_opening_id"];
            isOneToOne: false;
            referencedRelation: "pack_openings";
            referencedColumns: ["id"];
          },
        ];
      };
      release_allowed_countries: {
        Row: {
          approval_reference: string | null;
          approved_at: string | null;
          country_code: string;
          enabled: boolean;
          release_mode: string;
        };
        Insert: {
          approval_reference?: string | null;
          approved_at?: string | null;
          country_code: string;
          enabled?: boolean;
          release_mode: string;
        };
        Update: {
          approval_reference?: string | null;
          approved_at?: string | null;
          country_code?: string;
          enabled?: boolean;
          release_mode?: string;
        };
        Relationships: [];
      };
      season_games: {
        Row: {
          away_lineup: Json | null;
          away_score: number | null;
          away_team_id: string | null;
          day_number: number;
          game_number: number;
          home_lineup: Json | null;
          home_score: number | null;
          home_team_id: string | null;
          id: string;
          league_id: string;
          lock_at: string;
          played_at: string | null;
          round: string;
          season_id: string;
          simulation: Json | null;
          status: string;
          winner_team_id: string | null;
        };
        Insert: {
          away_lineup?: Json | null;
          away_score?: number | null;
          away_team_id?: string | null;
          day_number: number;
          game_number: number;
          home_lineup?: Json | null;
          home_score?: number | null;
          home_team_id?: string | null;
          id?: string;
          league_id: string;
          lock_at: string;
          played_at?: string | null;
          round: string;
          season_id: string;
          simulation?: Json | null;
          status?: string;
          winner_team_id?: string | null;
        };
        Update: {
          away_lineup?: Json | null;
          away_score?: number | null;
          away_team_id?: string | null;
          day_number?: number;
          game_number?: number;
          home_lineup?: Json | null;
          home_score?: number | null;
          home_team_id?: string | null;
          id?: string;
          league_id?: string;
          lock_at?: string;
          played_at?: string | null;
          round?: string;
          season_id?: string;
          simulation?: Json | null;
          status?: string;
          winner_team_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "season_games_away_team_id_fkey";
            columns: ["away_team_id"];
            isOneToOne: false;
            referencedRelation: "league_teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "season_games_home_team_id_fkey";
            columns: ["home_team_id"];
            isOneToOne: false;
            referencedRelation: "league_teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "season_games_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "season_leagues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "season_games_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "season_games_winner_team_id_fkey";
            columns: ["winner_team_id"];
            isOneToOne: false;
            referencedRelation: "league_teams";
            referencedColumns: ["id"];
          },
        ];
      };
      season_leagues: {
        Row: {
          created_at: string;
          id: string;
          league_number: number;
          season_id: string;
          tier: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          league_number: number;
          season_id: string;
          tier?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          league_number?: number;
          season_id?: string;
          tier?: string;
        };
        Relationships: [
          {
            foreignKeyName: "season_leagues_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
        ];
      };
      season_rewards: {
        Row: {
          coins: number;
          created_at: string;
          credited_at: string | null;
          final_rank: number;
          id: string;
          league_id: string;
          season_id: string;
          sol_lamports: number;
          status: string;
          team_id: string;
          user_id: string | null;
        };
        Insert: {
          coins?: number;
          created_at?: string;
          credited_at?: string | null;
          final_rank: number;
          id?: string;
          league_id: string;
          season_id: string;
          sol_lamports?: number;
          status?: string;
          team_id: string;
          user_id?: string | null;
        };
        Update: {
          coins?: number;
          created_at?: string;
          credited_at?: string | null;
          final_rank?: number;
          id?: string;
          league_id?: string;
          season_id?: string;
          sol_lamports?: number;
          status?: string;
          team_id?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "season_rewards_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "season_leagues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "season_rewards_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "season_rewards_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "league_teams";
            referencedColumns: ["id"];
          },
        ];
      };
      seasons: {
        Row: {
          created_at: string;
          ends_on: string;
          id: string;
          prize_pool_lamports: number;
          season_number: number;
          starts_on: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          ends_on: string;
          id?: string;
          prize_pool_lamports?: number;
          season_number: number;
          starts_on: string;
          status?: string;
        };
        Update: {
          created_at?: string;
          ends_on?: string;
          id?: string;
          prize_pool_lamports?: number;
          season_number?: number;
          starts_on?: string;
          status?: string;
        };
        Relationships: [];
      };
      solana_transaction_records: {
        Row: {
          amount_lamports: number;
          block_time: string | null;
          fee_lamports: number | null;
          market_purchase_id: string | null;
          network: string;
          purchase_id: string | null;
          purpose: string;
          reconciliation_status: string;
          recorded_at: string;
          sender_wallet: string;
          signature: string;
          slot: number | null;
          treasury_wallet: string;
          user_id: string;
        };
        Insert: {
          amount_lamports: number;
          block_time?: string | null;
          fee_lamports?: number | null;
          market_purchase_id?: string | null;
          network: string;
          purchase_id?: string | null;
          purpose?: string;
          reconciliation_status?: string;
          recorded_at?: string;
          sender_wallet: string;
          signature: string;
          slot?: number | null;
          treasury_wallet: string;
          user_id: string;
        };
        Update: {
          amount_lamports?: number;
          block_time?: string | null;
          fee_lamports?: number | null;
          market_purchase_id?: string | null;
          network?: string;
          purchase_id?: string | null;
          purpose?: string;
          reconciliation_status?: string;
          recorded_at?: string;
          sender_wallet?: string;
          signature?: string;
          slot?: number | null;
          treasury_wallet?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "solana_transaction_records_market_purchase_id_fkey";
            columns: ["market_purchase_id"];
            isOneToOne: true;
            referencedRelation: "market_sol_purchases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "solana_transaction_records_purchase_id_fkey";
            columns: ["purchase_id"];
            isOneToOne: true;
            referencedRelation: "gridiron_cash_purchases";
            referencedColumns: ["id"];
          },
        ];
      };
      starting_lineups: {
        Row: {
          card_id: string | null;
          slot: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          card_id?: string | null;
          slot: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          card_id?: string | null;
          slot?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "starting_lineups_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "player_cards";
            referencedColumns: ["id"];
          },
        ];
      };
      transaction_reconciliation_events: {
        Row: {
          created_at: string;
          evidence_reference: string | null;
          id: string;
          notes: string | null;
          reviewer_id: string | null;
          signature: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          evidence_reference?: string | null;
          id?: string;
          notes?: string | null;
          reviewer_id?: string | null;
          signature: string;
          status: string;
        };
        Update: {
          created_at?: string;
          evidence_reference?: string | null;
          id?: string;
          notes?: string | null;
          reviewer_id?: string | null;
          signature?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transaction_reconciliation_events_signature_fkey";
            columns: ["signature"];
            isOneToOne: false;
            referencedRelation: "financial_event_export";
            referencedColumns: ["signature"];
          },
          {
            foreignKeyName: "transaction_reconciliation_events_signature_fkey";
            columns: ["signature"];
            isOneToOne: false;
            referencedRelation: "solana_transaction_records";
            referencedColumns: ["signature"];
          },
        ];
      };
      treasury_allocation: {
        Row: {
          current_pool_lamports: number;
          development_lamports: number;
          next_pool_lamports: number;
          singleton: boolean;
          updated_at: string;
        };
        Insert: {
          current_pool_lamports?: number;
          development_lamports?: number;
          next_pool_lamports?: number;
          singleton?: boolean;
          updated_at?: string;
        };
        Update: {
          current_pool_lamports?: number;
          development_lamports?: number;
          next_pool_lamports?: number;
          singleton?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      financial_event_export: {
        Row: {
          accounting_status: string | null;
          amount_lamports: number | null;
          block_time: string | null;
          buyer_user_id: string | null;
          destination_wallet: string | null;
          fee_lamports: number | null;
          gc_amount: number | null;
          network: string | null;
          purpose: string | null;
          recorded_at: string | null;
          seller_user_id: string | null;
          sender_wallet: string | null;
          signature: string | null;
          slot: number | null;
          usd_fmv_cents: number | null;
          usd_price_source: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      accept_current_legal_documents: {
        Args: { p_age_of_majority_attested: boolean; p_country_code: string };
        Returns: Json;
      };
      base_card_name: {
        Args: { p_position: string; p_rarity: string };
        Returns: string;
      };
      bootstrap_game_account: { Args: never; Returns: Json };
      bootstrap_market_account: {
        Args: { p_starting_coins: number };
        Returns: number;
      };
      bot_scouting_cards: {
        Args: { p_team: Database["public"]["Tables"]["league_teams"]["Row"] };
        Returns: Json;
      };
      buy_market_listing_coins: {
        Args: { p_listing_id: string };
        Returns: {
          balance: number;
          card_data: Json;
        }[];
      };
      cancel_market_listing: { Args: { p_listing_id: string }; Returns: Json };
      card_json: {
        Args: { card: Database["public"]["Tables"]["player_cards"]["Row"] };
        Returns: Json;
      };
      claim_beta_developer_access: { Args: { p_token: string }; Returns: Json };
      claim_fan_coins: { Args: { p_request_id: string }; Returns: Json };
      create_market_listing: {
        Args: {
          p_buy_now_price?: number;
          p_card_data: Json;
          p_currency: string;
          p_duration_hours?: number;
          p_sale_type: string;
          p_seller_wallet?: string;
          p_sol_lamports?: number;
          p_starting_price?: number;
        };
        Returns: {
          buy_now_price: number | null;
          buyer_id: string | null;
          card_data: Json;
          card_id: string;
          completed_at: string | null;
          created_at: string;
          currency: string;
          current_bid: number | null;
          expires_at: string;
          high_bidder_id: string | null;
          id: string;
          sale_type: string;
          seller_id: string;
          seller_wallet: string | null;
          sol_lamports: number | null;
          starting_price: number | null;
          status: string;
        };
        SetofOptions: {
          from: "*";
          to: "market_listings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_playoff_round: {
        Args: { p_day: number; p_league_id: string };
        Returns: undefined;
      };
      create_random_card: {
        Args: {
          p_opening_id: string;
          p_owner_id: string;
          p_position?: string;
          p_program?: string;
          p_rarity: string;
        };
        Returns: {
          acquired_at: string;
          fan_value: number;
          id: string;
          iq: number;
          name: string;
          overall: number;
          owner_id: string;
          pack_opening_id: string | null;
          popularity: number;
          position: string;
          program: string;
          rarity: string;
          signature_key: string;
          signature_label: string;
          signature_value: number;
          speed: number;
          status: string;
          strength: number;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "player_cards";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      ensure_current_season: {
        Args: never;
        Returns: {
          created_at: string;
          ends_on: string;
          id: string;
          prize_pool_lamports: number;
          season_number: number;
          starts_on: string;
          status: string;
        };
        SetofOptions: {
          from: "*";
          to: "seasons";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      ensure_user_league: {
        Args: { p_user_id: string };
        Returns: {
          bot_overall: number;
          eliminated: boolean;
          final_rank: number | null;
          id: string;
          league_id: string;
          losses: number;
          name: string;
          playoff_seed: number | null;
          points_against: number;
          points_for: number;
          seat: number;
          user_id: string | null;
          wins: number;
        };
        SetofOptions: {
          from: "*";
          to: "league_teams";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      finalize_gridiron_cash_purchase: {
        Args: { p_purchase_id: string; p_signature: string; p_user_id: string };
        Returns: {
          balance: number;
          current_pool_lamports: number;
          development_lamports: number;
          expected_lamports: number;
          finalized_at: string;
          gc_amount: number;
          next_pool_lamports: number;
        }[];
      };
      finalize_league_rewards: {
        Args: { p_league_id: string };
        Returns: undefined;
      };
      finalize_market_sol_purchase: {
        Args: { p_buyer_id: string; p_purchase_id: string; p_signature: string };
        Returns: Json;
      };
      get_beta_developer_status: { Args: never; Returns: Json };
      get_game_snapshot: { Args: never; Returns: Json };
      get_my_market_activity: { Args: never; Returns: Json };
      get_pending_fan_claim: { Args: never; Returns: Json };
      get_release_eligibility: { Args: never; Returns: Json };
      get_today_official_game: { Args: never; Returns: Json };
      grant_beta_test_currency: {
        Args: { p_amount: number; p_currency: string; p_request_id: string };
        Returns: Json;
      };
      kickoff_at: { Args: { p_date: string }; Returns: string };
      lineup_snapshot: { Args: { p_user_id: string }; Returns: Json };
      open_authoritative_pack: {
        Args: {
          p_currency: string;
          p_pack_code: string;
          p_position?: string;
          p_request_id: string;
        };
        Returns: Json;
      };
      place_market_bid: {
        Args: { p_amount: number; p_listing_id: string };
        Returns: {
          balance: number;
          current_bid: number;
        }[];
      };
      position_signature: { Args: { p_position: string }; Returns: Json };
      process_all_due_season_games: { Args: never; Returns: number };
      process_due_league_games: {
        Args: { p_league_id: string };
        Returns: number;
      };
      quick_sell_market_card: { Args: { p_card_id: string }; Returns: Json };
      recalculate_fans: { Args: { p_user_id: string }; Returns: number };
      require_beta_developer: { Args: never; Returns: string };
      require_current_legal_acceptance: { Args: never; Returns: string };
      roll_pack_rarity: {
        Args: { p_floor: string; p_position_pack?: boolean };
        Returns: string;
      };
      secure_random_integer: {
        Args: { p_max: number; p_min: number };
        Returns: number;
      };
      secure_random_unit: { Args: never; Returns: number };
      seed_league_schedule: {
        Args: { p_league_id: string; p_season_id: string; p_starts_on: string };
        Returns: undefined;
      };
      set_authoritative_lineup: {
        Args: { p_card_id: string; p_slot: string };
        Returns: Json;
      };
      set_authoritative_team_name: { Args: { p_name: string }; Returns: string };
      settle_expired_market_listings: { Args: never; Returns: number };
      simulate_season_game: {
        Args: { p_game_id: string };
        Returns: {
          away_lineup: Json | null;
          away_score: number | null;
          away_team_id: string | null;
          day_number: number;
          game_number: number;
          home_lineup: Json | null;
          home_score: number | null;
          home_team_id: string | null;
          id: string;
          league_id: string;
          lock_at: string;
          played_at: string | null;
          round: string;
          season_id: string;
          simulation: Json | null;
          status: string;
          winner_team_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "season_games";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
