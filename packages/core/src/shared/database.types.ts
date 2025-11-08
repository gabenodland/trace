// TypeScript types for Supabase database schema
// This file provides type safety for all database operations

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          category_id: string;
          user_id: string;
          name: string;
          full_path: string;
          parent_category_id: string | null;
          depth: number;
          entry_count: number;
          color: string | null;
          icon: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          category_id?: string;
          user_id: string;
          name: string;
          full_path: string;
          parent_category_id?: string | null;
          depth?: number;
          entry_count?: number;
          color?: string | null;
          icon?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          category_id?: string;
          user_id?: string;
          name?: string;
          full_path?: string;
          parent_category_id?: string | null;
          depth?: number;
          entry_count?: number;
          color?: string | null;
          icon?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_parent_category_id_fkey";
            columns: ["parent_category_id"];
            referencedRelation: "categories";
            referencedColumns: ["category_id"];
          },
          {
            foreignKeyName: "categories_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      entries: {
        Row: {
          entry_id: string;
          user_id: string;
          title: string | null;
          content: string;
          category_id: string | null;
          tags: string[];
          mentions: string[];
          created_at: string;
          updated_at: string;
          location_lat: number | null;
          location_lng: number | null;
          location_name: string | null;
          status: "none" | "incomplete" | "complete";
          due_date: string | null;
          completed_at: string | null;
          attachments: Json;
        };
        Insert: {
          entry_id?: string;
          user_id: string;
          title?: string | null;
          content: string;
          category_id?: string | null;
          tags?: string[];
          mentions?: string[];
          created_at?: string;
          updated_at?: string;
          location_lat?: number | null;
          location_lng?: number | null;
          location_name?: string | null;
          status?: "none" | "incomplete" | "complete";
          due_date?: string | null;
          completed_at?: string | null;
          attachments?: Json;
        };
        Update: {
          entry_id?: string;
          user_id?: string;
          title?: string | null;
          content?: string;
          category_id?: string | null;
          tags?: string[];
          mentions?: string[];
          created_at?: string;
          updated_at?: string;
          location_lat?: number | null;
          location_lng?: number | null;
          location_name?: string | null;
          status?: "none" | "incomplete" | "complete";
          due_date?: string | null;
          completed_at?: string | null;
          attachments?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "entries_category_id_fkey";
            columns: ["category_id"];
            referencedRelation: "categories";
            referencedColumns: ["category_id"];
          },
          {
            foreignKeyName: "entries_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_category_owner: {
        Args: {
          p_category_id: string;
        };
        Returns: boolean;
      };
      is_entry_owner: {
        Args: {
          p_entry_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
