// Generated from Supabase project qyebpmhhneszosykkjfj (generate_typescript_types), trimmed to what the app uses.
// Regenerate after every migration.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      episode_ratings: {
        Row: {
          anime_id: number;
          deleted_at: string | null;
          episode: number;
          rating: number | null;
          season: number;
          synced_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          anime_id: number;
          deleted_at?: string | null;
          episode: number;
          rating?: number | null;
          season: number;
          synced_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: Partial<Database['public']['Tables']['episode_ratings']['Insert']>;
        Relationships: [];
      };
      unlocked_banners: {
        Row: {
          anime_id: number;
          banner_url: string;
          is_trophy: boolean;
          title: string | null;
          unlocked_at: string;
          user_id: string;
        };
        Insert: {
          anime_id: number;
          banner_url: string;
          is_trophy?: boolean;
          title?: string | null;
          unlocked_at?: string;
          user_id?: string;
        };
        Update: Partial<Database['public']['Tables']['unlocked_banners']['Insert']>;
        Relationships: [];
      };
      episode_progress: {
        Row: {
          anime_id: number;
          duration: number;
          episode: number;
          season: number;
          time: number;
          updated_at: string;
          user_id: string;
          synced_at: string;
        };
        Insert: {
          anime_id: number;
          duration?: number;
          episode: number;
          season: number;
          time?: number;
          updated_at?: string;
          user_id?: string;
          synced_at?: string;
        };
        Update: Partial<Database['public']['Tables']['episode_progress']['Insert']>;
        Relationships: [];
      };
      history_entries: {
        Row: {
          anime_id: number;
          color: string | null;
          cover: string | null;
          deleted_at: string | null;
          episode_name: string | null;
          episode_number: number | null;
          lang: string | null;
          score: number | null;
          season: number | null;
          status: string | null;
          title: string | null;
          updated_at: string;
          user_id: string;
          watched_at: string | null;
          synced_at: string;
        };
        Insert: {
          anime_id: number;
          color?: string | null;
          cover?: string | null;
          deleted_at?: string | null;
          episode_name?: string | null;
          episode_number?: number | null;
          lang?: string | null;
          score?: number | null;
          season?: number | null;
          status?: string | null;
          title?: string | null;
          updated_at?: string;
          user_id?: string;
          watched_at?: string | null;
          synced_at?: string;
        };
        Update: Partial<Database['public']['Tables']['history_entries']['Insert']>;
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          banner_id: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          is_public: boolean;
          settings: Json;
          updated_at: string;
          username: string | null;
          visibility: Json;
        };
        Insert: {
          avatar_url?: string | null;
          banner_id?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
          is_public?: boolean;
          settings?: Json;
          updated_at?: string;
          username?: string | null;
          visibility?: Json;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
      watchlist_entries: {
        Row: {
          added_at: string;
          anime_id: number;
          color: string | null;
          cover: string | null;
          deleted_at: string | null;
          score: number | null;
          status: string | null;
          title: string | null;
          updated_at: string;
          user_id: string;
          synced_at: string;
          list_status: string;
          rating: number | null;
          completed_on_sakura_at: string | null;
          favorite: boolean;
        };
        Insert: {
          added_at?: string;
          anime_id: number;
          color?: string | null;
          cover?: string | null;
          deleted_at?: string | null;
          score?: number | null;
          status?: string | null;
          title?: string | null;
          updated_at?: string;
          user_id?: string;
          synced_at?: string;
          list_status?: string;
          rating?: number | null;
          completed_on_sakura_at?: string | null;
          favorite?: boolean;
        };
        Update: Partial<Database['public']['Tables']['watchlist_entries']['Insert']>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      delete_own_account: { Args: never; Returns: undefined };
      get_public_profile: { Args: { name: string }; Returns: Json };
      set_banner: { Args: { banner: string }; Returns: undefined };
      username_available: { Args: { name: string }; Returns: boolean };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicTables = Database['public']['Tables'];
export type Tables<T extends keyof PublicTables> = PublicTables[T]['Row'];
export type TablesInsert<T extends keyof PublicTables> = PublicTables[T]['Insert'];
