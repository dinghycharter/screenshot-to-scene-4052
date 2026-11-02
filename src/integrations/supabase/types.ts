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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      availability: {
        Row: {
          boat_id: string
          created_at: string
          end_date: string
          id: string
          note: string | null
          start_date: string
        }
        Insert: {
          boat_id: string
          created_at?: string
          end_date: string
          id?: string
          note?: string | null
          start_date: string
        }
        Update: {
          boat_id?: string
          created_at?: string
          end_date?: string
          id?: string
          note?: string | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
        ]
      }
      boat_events: {
        Row: {
          boat_id: string
          event_id: string
        }
        Insert: {
          boat_id: string
          event_id: string
        }
        Update: {
          boat_id?: string
          event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boat_events_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boat_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      boat_photos: {
        Row: {
          boat_id: string
          created_at: string
          id: string
          position: number
          url: string
        }
        Insert: {
          boat_id: string
          created_at?: string
          id?: string
          position?: number
          url: string
        }
        Update: {
          boat_id?: string
          created_at?: string
          id?: string
          position?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "boat_photos_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
        ]
      }
      boats: {
        Row: {
          city: string
          class_id: string
          country: string
          created_at: string
          currency: string
          daily_price: number
          description: string
          equipment: string[]
          id: string
          is_published: boolean
          manufacturer: string
          model: string
          owner_id: string
          pickup_location: string
          sail_number: string | null
          security_deposit: number
          specs: Json
          title: string
          updated_at: string
          year: number | null
        }
        Insert: {
          city: string
          class_id: string
          country: string
          created_at?: string
          currency?: string
          daily_price: number
          description?: string
          equipment?: string[]
          id?: string
          is_published?: boolean
          manufacturer?: string
          model?: string
          owner_id: string
          pickup_location?: string
          sail_number?: string | null
          security_deposit?: number
          specs?: Json
          title: string
          updated_at?: string
          year?: number | null
        }
        Update: {
          city?: string
          class_id?: string
          country?: string
          created_at?: string
          currency?: string
          daily_price?: number
          description?: string
          equipment?: string[]
          id?: string
          is_published?: boolean
          manufacturer?: string
          model?: string
          owner_id?: string
          pickup_location?: string
          sail_number?: string | null
          security_deposit?: number
          specs?: Json
          title?: string
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "boats_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boats_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          boat_id: string
          created_at: string
          daily_price: number
          end_date: string
          event_id: string | null
          id: string
          message: string | null
          owner_id: string
          payment_status: string
          sailor_id: string
          security_deposit: number
          start_date: string
          status: Database["public"]["Enums"]["booking_status"]
          total_price: number
          updated_at: string
        }
        Insert: {
          boat_id: string
          created_at?: string
          daily_price?: number
          end_date: string
          event_id?: string | null
          id?: string
          message?: string | null
          owner_id: string
          payment_status?: string
          sailor_id: string
          security_deposit?: number
          start_date: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_price?: number
          updated_at?: string
        }
        Update: {
          boat_id?: string
          created_at?: string
          daily_price?: number
          end_date?: string
          event_id?: string | null
          id?: string
          message?: string | null
          owner_id?: string
          payment_status?: string
          sailor_id?: string
          security_deposit?: number
          start_date?: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_sailor_id_fkey"
            columns: ["sailor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          category: string
          crew: number
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          category?: string
          crew?: number
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          category?: string
          crew?: number
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      conversations: {
        Row: {
          boat_id: string
          created_at: string
          id: string
          last_message_at: string
          owner_id: string
          sailor_id: string
        }
        Insert: {
          boat_id: string
          created_at?: string
          id?: string
          last_message_at?: string
          owner_id: string
          sailor_id: string
        }
        Update: {
          boat_id?: string
          created_at?: string
          id?: string
          last_message_at?: string
          owner_id?: string
          sailor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_sailor_id_fkey"
            columns: ["sailor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          city: string
          country: string
          description: string | null
          end_date: string
          id: string
          name: string
          slug: string
          sort_order: number
          start_date: string
        }
        Insert: {
          city: string
          country: string
          description?: string | null
          end_date: string
          id?: string
          name: string
          slug: string
          sort_order?: number
          start_date: string
        }
        Update: {
          city?: string
          country?: string
          description?: string | null
          end_date?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          start_date?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          is_system: boolean
          read_at: string | null
          sender_id: string | null
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          is_system?: boolean
          read_at?: string | null
          sender_id?: string | null
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_system?: boolean
          read_at?: string | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          avatar_url: string | null
          bio: string | null
          country: string | null
          created_at: string
          full_name: string
          home_club: string | null
          id: string
          is_demo: boolean
          languages: string[]
          updated_at: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          full_name?: string
          home_club?: string | null
          id: string
          is_demo?: boolean
          languages?: string[]
          updated_at?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          full_name?: string
          home_club?: string | null
          id?: string
          is_demo?: boolean
          languages?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          boat_id: string
          booking_id: string | null
          comment: string | null
          created_at: string
          id: string
          owner_id: string
          rating: number
          reviewer_id: string
        }
        Insert: {
          boat_id: string
          booking_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          owner_id: string
          rating: number
          reviewer_id: string
        }
        Update: {
          boat_id?: string
          booking_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          rating?: number
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_boats: {
        Row: {
          boat_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          boat_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          boat_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_boats_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_boats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      owner_ratings: {
        Row: {
          avg_rating: number | null
          owner_id: string | null
          review_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      boat_booked_ranges: {
        Args: { _boat_id: string }
        Returns: {
          end_date: string
          start_date: string
        }[]
      }
      is_conversation_participant: {
        Args: { _conversation_id: string }
        Returns: boolean
      }
      owns_boat: { Args: { _boat_id: string }; Returns: boolean }
      redact_contact_info: { Args: { _text: string }; Returns: string }
    }
    Enums: {
      account_type: "owner" | "sailor"
      booking_status:
        | "pending"
        | "confirmed"
        | "declined"
        | "cancelled"
        | "completed"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_type: ["owner", "sailor"],
      booking_status: [
        "pending",
        "confirmed",
        "declined",
        "cancelled",
        "completed",
      ],
    },
  },
} as const
