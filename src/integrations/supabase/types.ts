export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: unknown | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          user_id?: string
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      file_cache: {
        Row: {
          cached_at: string
          id: string
          mime_type: string | null
          modified_at: string | null
          name: string
          path: string
          preview_available: boolean | null
          server_id: string
          size: number | null
          thumbnail_url: string | null
          type: Database["public"]["Enums"]["file_type"]
        }
        Insert: {
          cached_at?: string
          id?: string
          mime_type?: string | null
          modified_at?: string | null
          name: string
          path: string
          preview_available?: boolean | null
          server_id: string
          size?: number | null
          thumbnail_url?: string | null
          type: Database["public"]["Enums"]["file_type"]
        }
        Update: {
          cached_at?: string
          id?: string
          mime_type?: string | null
          modified_at?: string | null
          name?: string
          path?: string
          preview_available?: boolean | null
          server_id?: string
          size?: number | null
          thumbnail_url?: string | null
          type?: Database["public"]["Enums"]["file_type"]
        }
        Relationships: [
          {
            foreignKeyName: "file_cache_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "server_config"
            referencedColumns: ["id"]
          },
        ]
      }
      file_permissions: {
        Row: {
          can_delete: boolean
          can_read: boolean
          can_write: boolean
          created_at: string
          granted_by: string
          id: string
          path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_delete?: boolean
          can_read?: boolean
          can_write?: boolean
          created_at?: string
          granted_by: string
          id?: string
          path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_delete?: boolean
          can_read?: boolean
          can_write?: boolean
          created_at?: string
          granted_by?: string
          id?: string
          path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      server_config: {
        Row: {
          created_at: string
          created_by: string
          host: string
          id: string
          is_active: boolean
          name: string
          passive_mode: boolean
          password: string
          port: number
          protocol: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          created_by: string
          host: string
          id?: string
          is_active?: boolean
          name?: string
          passive_mode?: boolean
          password: string
          port?: number
          protocol?: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          created_by?: string
          host?: string
          id?: string
          is_active?: boolean
          name?: string
          passive_mode?: boolean
          password?: string
          port?: number
          protocol?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          created_by: string | null
          full_name: string
          id: string
          is_active: boolean
          is_admin: boolean
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          is_admin?: boolean
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          is_admin?: boolean
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_email: {
        Args: { user_uuid: string }
        Returns: string
      }
      get_user_permissions: {
        Args: { user_uuid: string; file_path: string }
        Returns: {
          can_read: boolean
          can_write: boolean
          can_delete: boolean
        }[]
      }
      is_admin: {
        Args: { user_uuid?: string }
        Returns: boolean
      }
    }
    Enums: {
      connection_status: "active" | "inactive" | "error"
      file_type: "file" | "directory"
      upload_status: "pending" | "in_progress" | "completed" | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      connection_status: ["active", "inactive", "error"],
      file_type: ["file", "directory"],
      upload_status: ["pending", "in_progress", "completed", "failed"],
    },
  },
} as const
