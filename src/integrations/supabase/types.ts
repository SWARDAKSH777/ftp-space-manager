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
          created_at: string | null
          details: Json | null
          id: string
          ip_address: unknown | null
          server_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          server_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          server_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "ftp_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      file_cache: {
        Row: {
          cached_at: string | null
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
          cached_at?: string | null
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
          cached_at?: string | null
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
            referencedRelation: "ftp_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      ftp_servers: {
        Row: {
          created_at: string | null
          host: string
          id: string
          last_connected: string | null
          name: string
          passive_mode: boolean | null
          password: string
          port: number | null
          protocol: string | null
          shared_with_team: string | null
          status: Database["public"]["Enums"]["connection_status"] | null
          updated_at: string | null
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string | null
          host: string
          id?: string
          last_connected?: string | null
          name: string
          passive_mode?: boolean | null
          password: string
          port?: number | null
          protocol?: string | null
          shared_with_team?: string | null
          status?: Database["public"]["Enums"]["connection_status"] | null
          updated_at?: string | null
          user_id: string
          username: string
        }
        Update: {
          created_at?: string | null
          host?: string
          id?: string
          last_connected?: string | null
          name?: string
          passive_mode?: boolean | null
          password?: string
          port?: number | null
          protocol?: string | null
          shared_with_team?: string | null
          status?: Database["public"]["Enums"]["connection_status"] | null
          updated_at?: string | null
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "ftp_servers_shared_with_team_fkey"
            columns: ["shared_with_team"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      server_statistics: {
        Row: {
          file_types: Json | null
          id: string
          last_scan: string | null
          server_id: string
          size_distribution: Json | null
          total_directories: number | null
          total_files: number | null
          total_size: number | null
        }
        Insert: {
          file_types?: Json | null
          id?: string
          last_scan?: string | null
          server_id: string
          size_distribution?: Json | null
          total_directories?: number | null
          total_files?: number | null
          total_size?: number | null
        }
        Update: {
          file_types?: Json | null
          id?: string
          last_scan?: string | null
          server_id?: string
          size_distribution?: Json | null
          total_directories?: number | null
          total_files?: number | null
          total_size?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "server_statistics_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "ftp_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_ftp_servers: {
        Row: {
          can_edit: boolean | null
          created_at: string | null
          ftp_server_id: string
          id: string
          user_id: string
        }
        Insert: {
          can_edit?: boolean | null
          created_at?: string | null
          ftp_server_id: string
          id?: string
          user_id: string
        }
        Update: {
          can_edit?: boolean | null
          created_at?: string | null
          ftp_server_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_ftp_servers_ftp_server_id_fkey"
            columns: ["ftp_server_id"]
            isOneToOne: false
            referencedRelation: "ftp_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          joined_at: string | null
          role: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string | null
          role?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string | null
          role?: string | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      upload_history: {
        Row: {
          completed_at: string | null
          error_message: string | null
          file_name: string
          file_size: number | null
          id: string
          local_path: string | null
          remote_path: string
          schedule_id: string | null
          server_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["upload_status"] | null
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          local_path?: string | null
          remote_path: string
          schedule_id?: string | null
          server_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["upload_status"] | null
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          local_path?: string | null
          remote_path?: string
          schedule_id?: string | null
          server_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["upload_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "upload_history_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "upload_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upload_history_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "ftp_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_schedules: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          last_run: string | null
          local_path: string
          name: string
          next_run: string | null
          remote_path: string
          schedule_cron: string
          server_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_run?: string | null
          local_path: string
          name: string
          next_run?: string | null
          remote_path: string
          schedule_cron: string
          server_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_run?: string | null
          local_path?: string
          name?: string
          next_run?: string | null
          remote_path?: string
          schedule_cron?: string
          server_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "upload_schedules_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "ftp_servers"
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
