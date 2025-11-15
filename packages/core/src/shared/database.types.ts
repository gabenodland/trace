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
      categories: {
        Row: {
          base_version: number | null
          category_id: string
          color: string | null
          conflict_backup: Json | null
          conflict_status: string | null
          created_at: string
          depth: number
          entry_count: number
          full_path: string
          icon: string | null
          last_edited_by: string | null
          last_edited_device: string | null
          name: string
          parent_category_id: string | null
          updated_at: string
          user_id: string
          version: number | null
        }
        Insert: {
          base_version?: number | null
          category_id?: string
          color?: string | null
          conflict_backup?: Json | null
          conflict_status?: string | null
          created_at?: string
          depth?: number
          entry_count?: number
          full_path: string
          icon?: string | null
          last_edited_by?: string | null
          last_edited_device?: string | null
          name: string
          parent_category_id?: string | null
          updated_at?: string
          user_id: string
          version?: number | null
        }
        Update: {
          base_version?: number | null
          category_id?: string
          color?: string | null
          conflict_backup?: Json | null
          conflict_status?: string | null
          created_at?: string
          depth?: number
          entry_count?: number
          full_path?: string
          icon?: string | null
          last_edited_by?: string | null
          last_edited_device?: string | null
          name?: string
          parent_category_id?: string | null
          updated_at?: string
          user_id?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["category_id"]
          },
        ]
      }
      entries: {
        Row: {
          attachments: Json | null
          base_version: number | null
          category_id: string | null
          completed_at: string | null
          conflict_backup: Json | null
          conflict_status: string | null
          content: string
          created_at: string
          due_date: string | null
          entry_id: string
          last_edited_by: string | null
          last_edited_device: string | null
          location_lat: number | null
          location_lng: number | null
          location_name: string | null
          mentions: string[] | null
          status: string
          tags: string[] | null
          title: string | null
          updated_at: string
          user_id: string
          version: number | null
        }
        Insert: {
          attachments?: Json | null
          base_version?: number | null
          category_id?: string | null
          completed_at?: string | null
          conflict_backup?: Json | null
          conflict_status?: string | null
          content: string
          created_at?: string
          due_date?: string | null
          entry_id?: string
          last_edited_by?: string | null
          last_edited_device?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_name?: string | null
          mentions?: string[] | null
          status?: string
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          user_id: string
          version?: number | null
        }
        Update: {
          attachments?: Json | null
          base_version?: number | null
          category_id?: string | null
          completed_at?: string | null
          conflict_backup?: Json | null
          conflict_status?: string | null
          content?: string
          created_at?: string
          due_date?: string | null
          entry_id?: string
          last_edited_by?: string | null
          last_edited_device?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_name?: string | null
          mentions?: string[] | null
          status?: string
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          user_id?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["category_id"]
          },
        ]
      }
      photos: {
        Row: {
          created_at: string
          entry_id: string
          file_path: string
          mime_type: string
          photo_id: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_id: string
          file_path: string
          mime_type?: string
          photo_id?: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entry_id?: string
          file_path?: string
          mime_type?: string
          photo_id?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["entry_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_category_owner: { Args: { p_category_id: string }; Returns: boolean }
      is_entry_owner: { Args: { p_entry_id: string }; Returns: boolean }
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
