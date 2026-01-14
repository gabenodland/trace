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
      attachments: {
        Row: {
          attachment_id: string
          captured_at: string
          created_at: string
          entry_id: string
          file_path: string
          file_size: number
          height: number | null
          mime_type: string
          position: number
          thumbnail_path: string | null
          updated_at: string
          user_id: string
          width: number | null
        }
        Insert: {
          attachment_id?: string
          captured_at?: string
          created_at?: string
          entry_id: string
          file_path: string
          file_size: number
          height?: number | null
          mime_type?: string
          position?: number
          thumbnail_path?: string | null
          updated_at?: string
          user_id: string
          width?: number | null
        }
        Update: {
          attachment_id?: string
          captured_at?: string
          created_at?: string
          entry_id?: string
          file_path?: string
          file_size?: number
          height?: number | null
          mime_type?: string
          position?: number
          thumbnail_path?: string | null
          updated_at?: string
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["entry_id"]
          },
        ]
      }
      entries: {
        Row: {
          address: string | null
          attachments: Json | null
          base_version: number | null
          city: string | null
          completed_at: string | null
          conflict_backup: Json | null
          conflict_status: string | null
          content: string
          country: string | null
          created_at: string
          deleted_at: string | null
          due_date: string | null
          entry_date: string | null
          entry_id: string
          entry_latitude: number | null
          entry_longitude: number | null
          is_pinned: boolean
          last_edited_by: string | null
          last_edited_device: string | null
          location_accuracy: number | null
          location_id: string | null
          mentions: string[] | null
          neighborhood: string | null
          place_name: string | null
          postal_code: string | null
          priority: number
          rating: number
          region: string | null
          status: string
          stream_id: string | null
          subdivision: string | null
          tags: string[] | null
          title: string | null
          type: string | null
          updated_at: string
          user_id: string
          version: number | null
        }
        Insert: {
          address?: string | null
          attachments?: Json | null
          base_version?: number | null
          city?: string | null
          completed_at?: string | null
          conflict_backup?: Json | null
          conflict_status?: string | null
          content: string
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          due_date?: string | null
          entry_date?: string | null
          entry_id?: string
          entry_latitude?: number | null
          entry_longitude?: number | null
          is_pinned?: boolean
          last_edited_by?: string | null
          last_edited_device?: string | null
          location_accuracy?: number | null
          location_id?: string | null
          mentions?: string[] | null
          neighborhood?: string | null
          place_name?: string | null
          postal_code?: string | null
          priority?: number
          rating?: number
          region?: string | null
          status?: string
          stream_id?: string | null
          subdivision?: string | null
          tags?: string[] | null
          title?: string | null
          type?: string | null
          updated_at?: string
          user_id: string
          version?: number | null
        }
        Update: {
          address?: string | null
          attachments?: Json | null
          base_version?: number | null
          city?: string | null
          completed_at?: string | null
          conflict_backup?: Json | null
          conflict_status?: string | null
          content?: string
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          due_date?: string | null
          entry_date?: string | null
          entry_id?: string
          entry_latitude?: number | null
          entry_longitude?: number | null
          is_pinned?: boolean
          last_edited_by?: string | null
          last_edited_device?: string | null
          location_accuracy?: number | null
          location_id?: string | null
          mentions?: string[] | null
          neighborhood?: string | null
          place_name?: string | null
          postal_code?: string | null
          priority?: number
          rating?: number
          region?: string | null
          status?: string
          stream_id?: string | null
          subdivision?: string | null
          tags?: string[] | null
          title?: string | null
          type?: string | null
          updated_at?: string
          user_id?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "entries_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "entries_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["stream_id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string | null
          deleted_at: string | null
          foursquare_fsq_id: string | null
          latitude: number
          location_id: string
          longitude: number
          mapbox_place_id: string | null
          name: string
          neighborhood: string | null
          postal_code: string | null
          region: string | null
          source: string | null
          subdivision: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          deleted_at?: string | null
          foursquare_fsq_id?: string | null
          latitude: number
          location_id?: string
          longitude: number
          mapbox_place_id?: string | null
          name: string
          neighborhood?: string | null
          postal_code?: string | null
          region?: string | null
          source?: string | null
          subdivision?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          deleted_at?: string | null
          foursquare_fsq_id?: string | null
          latitude?: number
          location_id?: string
          longitude?: number
          mapbox_place_id?: string | null
          name?: string
          neighborhood?: string | null
          postal_code?: string | null
          region?: string | null
          source?: string | null
          subdivision?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          id: string
          name: string
          profile_complete: boolean | null
          updated_at: string | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          id: string
          name: string
          profile_complete?: boolean | null
          updated_at?: string | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          id?: string
          name?: string
          profile_complete?: boolean | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      streams: {
        Row: {
          base_version: number | null
          color: string | null
          conflict_backup: Json | null
          conflict_status: string | null
          created_at: string
          entry_content_template: string | null
          entry_content_type: string
          entry_count: number
          entry_default_status: string | null
          entry_rating_type: string | null
          entry_statuses: string[] | null
          entry_title_template: string | null
          entry_types: string[] | null
          entry_use_duedates: boolean
          entry_use_location: boolean
          entry_use_photos: boolean
          entry_use_priority: boolean
          entry_use_rating: boolean
          entry_use_status: boolean
          entry_use_type: boolean | null
          icon: string | null
          is_localonly: boolean
          is_private: boolean
          last_edited_by: string | null
          last_edited_device: string | null
          name: string
          stream_id: string
          updated_at: string
          user_id: string
          version: number | null
        }
        Insert: {
          base_version?: number | null
          color?: string | null
          conflict_backup?: Json | null
          conflict_status?: string | null
          created_at?: string
          entry_content_template?: string | null
          entry_content_type?: string
          entry_count?: number
          entry_default_status?: string | null
          entry_rating_type?: string | null
          entry_statuses?: string[] | null
          entry_title_template?: string | null
          entry_types?: string[] | null
          entry_use_duedates?: boolean
          entry_use_location?: boolean
          entry_use_photos?: boolean
          entry_use_priority?: boolean
          entry_use_rating?: boolean
          entry_use_status?: boolean
          entry_use_type?: boolean | null
          icon?: string | null
          is_localonly?: boolean
          is_private?: boolean
          last_edited_by?: string | null
          last_edited_device?: string | null
          name: string
          stream_id?: string
          updated_at?: string
          user_id: string
          version?: number | null
        }
        Update: {
          base_version?: number | null
          color?: string | null
          conflict_backup?: Json | null
          conflict_status?: string | null
          created_at?: string
          entry_content_template?: string | null
          entry_content_type?: string
          entry_count?: number
          entry_default_status?: string | null
          entry_rating_type?: string | null
          entry_statuses?: string[] | null
          entry_title_template?: string | null
          entry_types?: string[] | null
          entry_use_duedates?: boolean
          entry_use_location?: boolean
          entry_use_photos?: boolean
          entry_use_priority?: boolean
          entry_use_rating?: boolean
          entry_use_status?: boolean
          entry_use_type?: boolean | null
          icon?: string | null
          is_localonly?: boolean
          is_private?: boolean
          last_edited_by?: string | null
          last_edited_device?: string | null
          name?: string
          stream_id?: string
          updated_at?: string
          user_id?: string
          version?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_username_available: {
        Args: { username_param: string }
        Returns: boolean
      }
      generate_username_from_email: { Args: { email: string }; Returns: string }
      is_entry_owner: { Args: { p_entry_id: string }; Returns: boolean }
      is_stream_owner: { Args: { p_stream_id: string }; Returns: boolean }
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
