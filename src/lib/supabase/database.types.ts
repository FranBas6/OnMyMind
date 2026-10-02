export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json }
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
      item_links: {
        Row: {
          created_at: string
          currency: string
          id: string
          item_id: string
          position: number
          price_cents: number | null
          price_checked_at: string | null
          price_source: Database['public']['Enums']['price_source'] | null
          url: string
          url_site: string | null
          url_title: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          item_id: string
          position?: number
          price_cents?: number | null
          price_checked_at?: string | null
          price_source?: Database['public']['Enums']['price_source'] | null
          url: string
          url_site?: string | null
          url_title?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          item_id?: string
          position?: number
          price_cents?: number | null
          price_checked_at?: string | null
          price_source?: Database['public']['Enums']['price_source'] | null
          url?: string
          url_site?: string | null
          url_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'item_links_item_id_fkey'
            columns: ['item_id']
            isOneToOne: false
            referencedRelation: 'items'
            referencedColumns: ['id']
          },
        ]
      }
      item_prices: {
        Row: {
          currency: string
          id: number
          item_id: string
          price_cents: number
          recorded_at: string
          source: Database['public']['Enums']['price_source']
          store: string | null
        }
        Insert: {
          currency?: string
          id?: never
          item_id: string
          price_cents: number
          recorded_at?: string
          source?: Database['public']['Enums']['price_source']
          store?: string | null
        }
        Update: {
          currency?: string
          id?: never
          item_id?: string
          price_cents?: number
          recorded_at?: string
          source?: Database['public']['Enums']['price_source']
          store?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'item_prices_item_id_fkey'
            columns: ['item_id']
            isOneToOne: false
            referencedRelation: 'items'
            referencedColumns: ['id']
          },
        ]
      }
      items: {
        Row: {
          all_day: boolean
          completed_at: string | null
          created_at: string
          created_by: string
          currency: string | null
          due_at: string | null
          fields: NonNullable<Json>
          id: string
          image_path: string | null
          image_url: string | null
          kind: Database['public']['Enums']['item_kind']
          left_inbox_at: string | null
          left_inbox_id: string | null
          list_id: string
          notes: string | null
          parent_id: string | null
          position: number
          previous_price_cents: number | null
          price_cents: number | null
          price_checked_at: string | null
          price_link_id: string | null
          price_source: Database['public']['Enums']['price_source'] | null
          price_store: string | null
          recurrence: string | null
          status: string
          title: string
          updated_at: string
          url: string | null
          url_site: string | null
          url_title: string | null
        }
        Insert: {
          all_day?: boolean
          completed_at?: string | null
          created_at?: string
          created_by: string
          currency?: string | null
          due_at?: string | null
          fields?: NonNullable<Json>
          id?: string
          image_path?: string | null
          image_url?: string | null
          kind: Database['public']['Enums']['item_kind']
          left_inbox_at?: string | null
          left_inbox_id?: string | null
          list_id: string
          notes?: string | null
          parent_id?: string | null
          position?: number
          previous_price_cents?: number | null
          price_cents?: number | null
          price_checked_at?: string | null
          price_link_id?: string | null
          price_source?: Database['public']['Enums']['price_source'] | null
          price_store?: string | null
          recurrence?: string | null
          status?: string
          title: string
          updated_at?: string
          url?: string | null
          url_site?: string | null
          url_title?: string | null
        }
        Update: {
          all_day?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string
          currency?: string | null
          due_at?: string | null
          fields?: NonNullable<Json>
          id?: string
          image_path?: string | null
          image_url?: string | null
          kind?: Database['public']['Enums']['item_kind']
          left_inbox_at?: string | null
          left_inbox_id?: string | null
          list_id?: string
          notes?: string | null
          parent_id?: string | null
          position?: number
          previous_price_cents?: number | null
          price_cents?: number | null
          price_checked_at?: string | null
          price_link_id?: string | null
          price_source?: Database['public']['Enums']['price_source'] | null
          price_store?: string | null
          recurrence?: string | null
          status?: string
          title?: string
          updated_at?: string
          url?: string | null
          url_site?: string | null
          url_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'items_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'items_left_inbox_id_fkey'
            columns: ['left_inbox_id']
            isOneToOne: false
            referencedRelation: 'list_counters'
            referencedColumns: ['list_id']
          },
          {
            foreignKeyName: 'items_left_inbox_id_fkey'
            columns: ['left_inbox_id']
            isOneToOne: false
            referencedRelation: 'lists'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'items_list_id_fkey'
            columns: ['list_id']
            isOneToOne: false
            referencedRelation: 'list_counters'
            referencedColumns: ['list_id']
          },
          {
            foreignKeyName: 'items_list_id_fkey'
            columns: ['list_id']
            isOneToOne: false
            referencedRelation: 'lists'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'items_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'items'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'items_price_link_id_fkey'
            columns: ['price_link_id']
            isOneToOne: false
            referencedRelation: 'item_links'
            referencedColumns: ['id']
          },
        ]
      }
      list_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          invited_email: string | null
          list_id: string
          role: Database['public']['Enums']['member_role']
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          invited_email?: string | null
          list_id: string
          role?: Database['public']['Enums']['member_role']
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          invited_email?: string | null
          list_id?: string
          role?: Database['public']['Enums']['member_role']
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'list_members_list_id_fkey'
            columns: ['list_id']
            isOneToOne: false
            referencedRelation: 'list_counters'
            referencedColumns: ['list_id']
          },
          {
            foreignKeyName: 'list_members_list_id_fkey'
            columns: ['list_id']
            isOneToOne: false
            referencedRelation: 'lists'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'list_members_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      lists: {
        Row: {
          archived_at: string | null
          color: string
          created_at: string
          field_schema: Json | null
          icon: string | null
          id: string
          kind: Database['public']['Enums']['list_kind']
          name: string
          owner_id: string
          position: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          color?: string
          created_at?: string
          field_schema?: Json | null
          icon?: string | null
          id?: string
          kind?: Database['public']['Enums']['list_kind']
          name: string
          owner_id: string
          position?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          color?: string
          created_at?: string
          field_schema?: Json | null
          icon?: string | null
          id?: string
          kind?: Database['public']['Enums']['list_kind']
          name?: string
          owner_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lists_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          settings: NonNullable<Json>
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          settings?: NonNullable<Json>
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          settings?: NonNullable<Json>
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      list_counters: {
        Row: {
          done_count: number | null
          list_id: string | null
          pending_count: number | null
          pending_price_cents: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      default_item_kind: {
        Args: { p_kind: Database['public']['Enums']['list_kind'] }
        Returns: Database['public']['Enums']['item_kind']
      }
      is_active_sublist_status: { Args: { p_status: string }; Returns: boolean }
      is_final_status: { Args: { p_status: string }; Returns: boolean }
      is_list_member: { Args: { p_list_id: string }; Returns: boolean }
      item_statuses: {
        Args: { p_kind: Database['public']['Enums']['item_kind'] }
        Returns: string[]
      }
      link_store_name: { Args: { p_site: string; p_url: string }; Returns: string }
      price_savings: { Args: Record<PropertyKey, never>; Returns: number }
      translate_item_status: {
        Args: { p_kind: Database['public']['Enums']['item_kind']; p_status: string }
        Returns: string
      }
    }
    Enums: {
      item_kind: 'note' | 'task' | 'shopping' | 'event' | 'sublist'
      list_kind: 'inbox' | 'tasks' | 'shopping' | 'events' | 'custom'
      member_role: 'owner' | 'editor'
      price_source: 'manual' | 'web' | 'auto'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      item_kind: ['note', 'task', 'shopping', 'event', 'sublist'],
      list_kind: ['inbox', 'tasks', 'shopping', 'events', 'custom'],
      member_role: ['owner', 'editor'],
      price_source: ['manual', 'web', 'auto'],
    },
  },
} as const
