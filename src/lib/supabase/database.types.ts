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
      calendar_feeds: {
        Row: {
          created_at: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'calendar_feeds_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      hidden_lists: {
        Row: {
          created_at: string
          list_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          list_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          list_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'hidden_lists_list_id_fkey'
            columns: ['list_id']
            isOneToOne: false
            referencedRelation: 'list_counters'
            referencedColumns: ['list_id']
          },
          {
            foreignKeyName: 'hidden_lists_list_id_fkey'
            columns: ['list_id']
            isOneToOne: false
            referencedRelation: 'lists'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'hidden_lists_list_id_fkey'
            columns: ['list_id']
            isOneToOne: false
            referencedRelation: 'my_lists'
            referencedColumns: ['id']
          },
        ]
      }
      item_completions: {
        Row: {
          done_at: string
          done_by: string | null
          id: string
          item_id: string
          occurrence: string
        }
        Insert: {
          done_at?: string
          done_by?: string | null
          id?: string
          item_id: string
          occurrence: string
        }
        Update: {
          done_at?: string
          done_by?: string | null
          id?: string
          item_id?: string
          occurrence?: string
        }
        Relationships: [
          {
            foreignKeyName: 'item_completions_done_by_fkey'
            columns: ['done_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'item_completions_item_id_fkey'
            columns: ['item_id']
            isOneToOne: false
            referencedRelation: 'items'
            referencedColumns: ['id']
          },
        ]
      }
      item_images: {
        Row: {
          created_at: string
          id: string
          item_id: string
          path: string
          position: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          path: string
          position?: number
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          path?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: 'item_images_item_id_fkey'
            columns: ['item_id']
            isOneToOne: false
            referencedRelation: 'items'
            referencedColumns: ['id']
          },
        ]
      }
      item_links: {
        Row: {
          created_at: string
          currency: string
          id: string
          item_id: string
          position: number
          price_cents: number | null
          price_checked_at: string | null
          price_failed_at: string | null
          price_failures: number
          price_followed: boolean
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
          price_failed_at?: string | null
          price_failures?: number
          price_followed?: boolean
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
          price_failed_at?: string | null
          price_failures?: number
          price_followed?: boolean
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
          choose_one: boolean
          chosen_id: string | null
          completed_at: string | null
          completed_by: string | null
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
          price_failed_at: string | null
          price_failures: number
          price_followed: boolean
          price_link_id: string | null
          price_source: Database['public']['Enums']['price_source'] | null
          price_store: string | null
          protected: boolean
          recurrence: string | null
          sealed_iv: string | null
          sealed_key_id: string | null
          sealed_notes: string | null
          status: string
          title: string
          updated_at: string
          url: string | null
          url_site: string | null
          url_title: string | null
          in_hidden_list: boolean | null
        }
        Insert: {
          all_day?: boolean
          choose_one?: boolean
          chosen_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
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
          price_failed_at?: string | null
          price_failures?: number
          price_followed?: boolean
          price_link_id?: string | null
          price_source?: Database['public']['Enums']['price_source'] | null
          price_store?: string | null
          protected?: boolean
          recurrence?: string | null
          sealed_iv?: string | null
          sealed_key_id?: string | null
          sealed_notes?: string | null
          status?: string
          title: string
          updated_at?: string
          url?: string | null
          url_site?: string | null
          url_title?: string | null
        }
        Update: {
          all_day?: boolean
          choose_one?: boolean
          chosen_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
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
          price_failed_at?: string | null
          price_failures?: number
          price_followed?: boolean
          price_link_id?: string | null
          price_source?: Database['public']['Enums']['price_source'] | null
          price_store?: string | null
          protected?: boolean
          recurrence?: string | null
          sealed_iv?: string | null
          sealed_key_id?: string | null
          sealed_notes?: string | null
          status?: string
          title?: string
          updated_at?: string
          url?: string | null
          url_site?: string | null
          url_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'items_chosen_id_fkey'
            columns: ['chosen_id']
            isOneToOne: false
            referencedRelation: 'items'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'items_completed_by_fkey'
            columns: ['completed_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
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
            foreignKeyName: 'items_left_inbox_id_fkey'
            columns: ['left_inbox_id']
            isOneToOne: false
            referencedRelation: 'my_lists'
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
            foreignKeyName: 'items_list_id_fkey'
            columns: ['list_id']
            isOneToOne: false
            referencedRelation: 'my_lists'
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
      list_departures: {
        Row: {
          happened_at: string
          list_id: string
          list_name: string
          owner_name: string | null
          reason: string
          user_id: string
        }
        Insert: {
          happened_at?: string
          list_id: string
          list_name: string
          owner_name?: string | null
          reason: string
          user_id: string
        }
        Update: {
          happened_at?: string
          list_id?: string
          list_name?: string
          owner_name?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'list_departures_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      list_invites: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          list_id: string
          revoked_at: string | null
          token: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          list_id: string
          revoked_at?: string | null
          token: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          list_id?: string
          revoked_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: 'list_invites_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'list_invites_list_id_fkey'
            columns: ['list_id']
            isOneToOne: false
            referencedRelation: 'list_counters'
            referencedColumns: ['list_id']
          },
          {
            foreignKeyName: 'list_invites_list_id_fkey'
            columns: ['list_id']
            isOneToOne: false
            referencedRelation: 'lists'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'list_invites_list_id_fkey'
            columns: ['list_id']
            isOneToOne: false
            referencedRelation: 'my_lists'
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
          position: number
          role: Database['public']['Enums']['member_role']
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          invited_email?: string | null
          list_id: string
          position?: number
          role?: Database['public']['Enums']['member_role']
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          invited_email?: string | null
          list_id?: string
          position?: number
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
            foreignKeyName: 'list_members_list_id_fkey'
            columns: ['list_id']
            isOneToOne: false
            referencedRelation: 'my_lists'
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
          view: string
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
          view?: string
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
          view?: string
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
      price_alerts: {
        Row: {
          created_at: string
          item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'price_alerts_item_id_fkey'
            columns: ['item_id']
            isOneToOne: false
            referencedRelation: 'items'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'price_alerts_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      private_vault_keys: {
        Row: {
          created_at: string
          credential_id: string
          device: string
          id: string
          key_id: string
          method: string
          prf_salt: string
          user_id: string
          wrap_iv: string
          wrapped_key: string
        }
        Insert: {
          created_at?: string
          credential_id: string
          device: string
          id?: string
          key_id: string
          method: string
          prf_salt: string
          user_id?: string
          wrap_iv: string
          wrapped_key: string
        }
        Update: {
          created_at?: string
          credential_id?: string
          device?: string
          id?: string
          key_id?: string
          method?: string
          prf_salt?: string
          user_id?: string
          wrap_iv?: string
          wrapped_key?: string
        }
        Relationships: []
      }
      private_vaults: {
        Row: {
          created_at: string
          kdf: string
          kdf_iterations: number
          kdf_salt: string
          key_check: string
          key_id: string
          updated_at: string
          user_id: string
          wrap_iv: string
          wrapped_key: string
        }
        Insert: {
          created_at?: string
          kdf?: string
          kdf_iterations: number
          kdf_salt: string
          key_check: string
          key_id?: string
          updated_at?: string
          user_id?: string
          wrap_iv: string
          wrapped_key: string
        }
        Update: {
          created_at?: string
          kdf?: string
          kdf_iterations?: number
          kdf_salt?: string
          key_check?: string
          key_id?: string
          updated_at?: string
          user_id?: string
          wrap_iv?: string
          wrapped_key?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          settings: NonNullable<Json>
          summary_sent_on: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          settings?: NonNullable<Json>
          summary_sent_on?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          settings?: NonNullable<Json>
          summary_sent_on?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'push_subscriptions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      reminders: {
        Row: {
          created_at: string
          id: string
          item_id: string
          offset_minutes: number | null
          remind_at: string
          sent_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          offset_minutes?: number | null
          remind_at: string
          sent_at?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          offset_minutes?: number | null
          remind_at?: string
          sent_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'reminders_item_id_fkey'
            columns: ['item_id']
            isOneToOne: true
            referencedRelation: 'items'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reminders_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      list_counters: {
        Row: {
          done_count: number | null
          event_total: number | null
          list_id: string | null
          note_total: number | null
          notes_count: number | null
          pending_count: number | null
          pending_price_cents: number | null
          shopping_total: number | null
          task_total: number | null
        }
        Relationships: []
      }
      my_lists: {
        Row: {
          archived_at: string | null
          color: string | null
          hidden: boolean | null
          icon: string | null
          id: string | null
          is_owner: boolean | null
          kind: Database['public']['Enums']['list_kind'] | null
          name: string | null
          owner_id: string | null
          position: number | null
          view: string | null
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
    }
    Functions: {
      accept_list_invite: {
        Args: { p_token: string }
        Returns: {
          list_id: string
          status: string
        }[]
      }
      broadcast_list: { Args: { p_list_id: string; p_payload: Json }; Returns: undefined }
      broadcast_user: { Args: { p_payload: Json; p_user_id: string }; Returns: undefined }
      calendar_feed: { Args: { p_token: string }; Returns: Json }
      calendar_token: { Args: Record<PropertyKey, never>; Returns: string }
      can_see_photo: { Args: { p_name: string }; Returns: boolean }
      change_author: { Args: Record<PropertyKey, never>; Returns: Json }
      claim_daily_summaries: {
        Args: Record<PropertyKey, never>
        Returns: {
          all_day: boolean
          kind: string
          occurs_local: string
          overdue: boolean
          title: string
          user_id: string
        }[]
      }
      claim_due_reminders: {
        Args: { p_limit?: number }
        Returns: {
          all_day: boolean
          concealed: boolean
          done: boolean
          hidden: boolean
          item_id: string
          kind: string
          list_id: string
          list_name: string
          now_local: string
          occurs_at: string
          occurs_local: string
          remind_at: string
          reminder_id: string
          title: string
          user_id: string
        }[]
      }
      create_list_invite: {
        Args: { p_list_id: string }
        Returns: {
          invite_expires_at: string
          invite_token: string
        }[]
      }
      default_item_kind: {
        Args: { p_kind: Database['public']['Enums']['list_kind'] }
        Returns: Database['public']['Enums']['item_kind']
      }
      delete_own_account: { Args: Record<PropertyKey, never>; Returns: undefined }
      duplicate_list: { Args: { p_list_id: string; p_name: string }; Returns: Json }
      has_recent_email_code: { Args: Record<PropertyKey, never>; Returns: boolean }
      in_hidden_list: {
        Args: { '': Database['public']['Tables']['items']['Row'] }
        Returns: {
          error: true
        } & 'the function public.in_hidden_list with parameter or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache'
      }
      invoke_refresh_prices: { Args: Record<PropertyKey, never>; Returns: number }
      invoke_send_reminders: { Args: Record<PropertyKey, never>; Returns: number }
      is_active_sublist_status: { Args: { p_status: string }; Returns: boolean }
      is_final_status: { Args: { p_status: string }; Returns: boolean }
      is_hidden_list: { Args: { p_list_id: string }; Returns: boolean }
      is_list_member: { Args: { p_list_id: string }; Returns: boolean }
      item_statuses: {
        Args: { p_kind: Database['public']['Enums']['item_kind'] }
        Returns: string[]
      }
      link_store_name: { Args: { p_site: string; p_url: string }; Returns: string }
      list_has_protected: { Args: { p_list_id: string }; Returns: boolean }
      list_invite_preview: {
        Args: { p_token: string }
        Returns: {
          inviter_name: string
          list_color: string
          list_id: string
          list_kind: Database['public']['Enums']['list_kind']
          list_name: string
          member_since: string
          pending_count: number
          status: string
        }[]
      }
      list_is_shared: { Args: { p_list_id: string }; Returns: boolean }
      list_people: {
        Args: { p_list_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          is_owner: boolean
          joined_at: string
          user_id: string
        }[]
      }
      my_price_drops: {
        Args: Record<PropertyKey, never>
        Returns: {
          currency: string
          image_path: string
          image_url: string
          item_id: string
          list_id: string
          list_name: string
          previous_price_cents: number
          price_cents: number
          store: string
          title: string
        }[]
      }
      new_calendar_token: { Args: Record<PropertyKey, never>; Returns: string }
      next_occurrence: {
        Args: { p_after: string; p_first: string; p_rule: string; p_tz: string }
        Returns: string
      }
      note_list_departure: {
        Args: { p_list_id: string; p_reason: string; p_user_id?: string }
        Returns: undefined
      }
      orphan_photos: { Args: Record<PropertyKey, never>; Returns: string[] }
      own_photos: { Args: Record<PropertyKey, never>; Returns: string[] }
      price_checks_due: {
        Args: { p_limit?: number }
        Returns: {
          id: string
          target: string
          url: string
        }[]
      }
      price_savings: { Args: Record<PropertyKey, never>; Returns: number }
      record_price_check: {
        Args: { p_currency?: string; p_id: string; p_price_cents: number; p_target: string }
        Returns: {
          after_cents: number
          before_cents: number
          before_checked_at: string
          concealed_for: string[]
          currency: string
          item_id: string
          list_id: string
          recipients: string[]
          store: string
          title: string
        }[]
      }
      recurrence_is_valid: { Args: { p_rule: string }; Returns: boolean }
      recurrence_occurrence: {
        Args: { p_first: string; p_from: string; p_rule: string }
        Returns: string
      }
      recurrence_on_day: {
        Args: { p_day: number; p_month: string; p_time: string }
        Returns: string
      }
      recurrence_rule: { Args: { p_text: string }; Returns: string }
      reminder_time: {
        Args: {
          p_after: string
          p_due_at: string
          p_offset: number
          p_recurrence: string
          p_tz: string
        }
        Returns: string
      }
      reset_private_vault: {
        Args: {
          p_kdf_iterations: number
          p_kdf_salt: string
          p_key_check: string
          p_wrap_iv: string
          p_wrapped_key: string
        }
        Returns: string
      }
      revoke_list_invite: { Args: { p_list_id: string }; Returns: undefined }
      rotate_calendar_token: { Args: Record<PropertyKey, never>; Returns: string }
      save_push_subscription: {
        Args: { p_auth: string; p_endpoint: string; p_p256dh: string; p_user_agent: string }
        Returns: undefined
      }
      set_list_positions: { Args: { p_changes: Json }; Returns: undefined }
      shared_list_people: {
        Args: Record<PropertyKey, never>
        Returns: {
          avatar_url: string
          display_name: string
          is_owner: boolean
          joined_at: string
          list_id: string
          user_id: string
        }[]
      }
      start_of_user_day: { Args: Record<PropertyKey, never>; Returns: string }
      translate_item_status: {
        Args: { p_kind: Database['public']['Enums']['item_kind']; p_status: string }
        Returns: string
      }
      undo_repeat: { Args: { p_item_id: string }; Returns: undefined }
      user_timezone: { Args: { p_user_id: string }; Returns: string }
      verify_cron_secret: { Args: { p_secret: string }; Returns: boolean }
    }
    Enums: {
      item_kind: 'note' | 'task' | 'shopping' | 'event' | 'sublist'
      list_kind: 'inbox' | 'tasks' | 'shopping' | 'events' | 'list'
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
      list_kind: ['inbox', 'tasks', 'shopping', 'events', 'list'],
      member_role: ['owner', 'editor'],
      price_source: ['manual', 'web', 'auto'],
    },
  },
} as const
