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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          order_id: string
          order_type: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          order_id: string
          order_type: string
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          order_id?: string
          order_type?: string
          sender_id?: string
        }
        Relationships: []
      }
      driver_profiles: {
        Row: {
          availability: string
          created_at: string
          id: string
          is_online: boolean
          license_number: string
          national_id_url: string | null
          profile_photo_url: string | null
          service_mode: string
          updated_at: string
          vehicle_brand: string | null
          vehicle_photo_url: string | null
          vehicle_registration_url: string | null
          vehicle_type: string
        }
        Insert: {
          availability?: string
          created_at?: string
          id: string
          is_online?: boolean
          license_number?: string
          national_id_url?: string | null
          profile_photo_url?: string | null
          service_mode?: string
          updated_at?: string
          vehicle_brand?: string | null
          vehicle_photo_url?: string | null
          vehicle_registration_url?: string | null
          vehicle_type?: string
        }
        Update: {
          availability?: string
          created_at?: string
          id?: string
          is_online?: boolean
          license_number?: string
          national_id_url?: string | null
          profile_photo_url?: string | null
          service_mode?: string
          updated_at?: string
          vehicle_brand?: string | null
          vehicle_photo_url?: string | null
          vehicle_registration_url?: string | null
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_contacts: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string
          relationship: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone: string
          relationship?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string
          relationship?: string | null
          user_id?: string
        }
        Relationships: []
      }
      food_orders: {
        Row: {
          created_at: string
          customer_id: string
          delivered_at: string | null
          delivery_address: string
          delivery_fee: number | null
          delivery_lat: number | null
          delivery_lng: number | null
          driver_id: string | null
          estimated_delivery_time: string | null
          id: string
          items: Json
          notes: string | null
          payment_method: string | null
          restaurant_id: string
          status: Database["public"]["Enums"]["food_order_status"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          delivered_at?: string | null
          delivery_address: string
          delivery_fee?: number | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          driver_id?: string | null
          estimated_delivery_time?: string | null
          id?: string
          items?: Json
          notes?: string | null
          payment_method?: string | null
          restaurant_id: string
          status?: Database["public"]["Enums"]["food_order_status"]
          total_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          delivered_at?: string | null
          delivery_address?: string
          delivery_fee?: number | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          driver_id?: string | null
          estimated_delivery_time?: string | null
          id?: string
          items?: Json
          notes?: string | null
          payment_method?: string | null
          restaurant_id?: string
          status?: Database["public"]["Enums"]["food_order_status"]
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean
          name: string
          price: number
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name: string
          price: number
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name?: string
          price?: number
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      parcels: {
        Row: {
          created_at: string
          delivered_at: string | null
          delivery_otp: string | null
          driver_id: string | null
          dropoff_lat: number | null
          dropoff_lng: number | null
          dropoff_location: string
          fare: number | null
          id: string
          notes: string | null
          otp_verified_at: string | null
          package_description: string | null
          package_type: string | null
          picked_up_at: string | null
          pickup_lat: number | null
          pickup_lng: number | null
          pickup_location: string
          recipient_name: string
          recipient_phone: string
          sender_id: string
          status: Database["public"]["Enums"]["parcel_status"]
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          delivery_otp?: string | null
          driver_id?: string | null
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_location: string
          fare?: number | null
          id?: string
          notes?: string | null
          otp_verified_at?: string | null
          package_description?: string | null
          package_type?: string | null
          picked_up_at?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_location: string
          recipient_name: string
          recipient_phone: string
          sender_id: string
          status?: Database["public"]["Enums"]["parcel_status"]
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          delivery_otp?: string | null
          driver_id?: string | null
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_location?: string
          fare?: number | null
          id?: string
          notes?: string | null
          otp_verified_at?: string | null
          package_description?: string | null
          package_type?: string | null
          picked_up_at?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_location?: string
          recipient_name?: string
          recipient_phone?: string
          sender_id?: string
          status?: Database["public"]["Enums"]["parcel_status"]
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          avatar_url: string | null
          city: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_flagged: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_flagged?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_flagged?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string
          from_user_id: string
          id: string
          order_id: string
          order_type: string
          rating: number
          restaurant_id: string | null
          to_user_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          from_user_id: string
          id?: string
          order_id: string
          order_type: string
          rating: number
          restaurant_id?: string | null
          to_user_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          from_user_id?: string
          id?: string
          order_id?: string
          order_type?: string
          rating?: number
          restaurant_id?: string | null
          to_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ratings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string
          business_license_url: string | null
          closing_time: string | null
          created_at: string
          cuisine_type: string | null
          description: string | null
          id: string
          image_url: string | null
          is_open: boolean
          name: string
          opening_hours: Json | null
          opening_time: string | null
          owner_id: string
          phone: string | null
          rating: number | null
          updated_at: string
        }
        Insert: {
          address: string
          business_license_url?: string | null
          closing_time?: string | null
          created_at?: string
          cuisine_type?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_open?: boolean
          name: string
          opening_hours?: Json | null
          opening_time?: string | null
          owner_id: string
          phone?: string | null
          rating?: number | null
          updated_at?: string
        }
        Update: {
          address?: string
          business_license_url?: string | null
          closing_time?: string | null
          created_at?: string
          cuisine_type?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_open?: boolean
          name?: string
          opening_hours?: Json | null
          opening_time?: string | null
          owner_id?: string
          phone?: string | null
          rating?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      rides: {
        Row: {
          cancellation_reason: string | null
          completed_at: string | null
          created_at: string
          distance_km: number | null
          driver_id: string | null
          dropoff_lat: number | null
          dropoff_lng: number | null
          dropoff_location: string
          fare: number | null
          id: string
          notes: string | null
          pickup_lat: number | null
          pickup_lng: number | null
          pickup_location: string
          rider_id: string
          scheduled_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"]
          updated_at: string
          vehicle_type: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          completed_at?: string | null
          created_at?: string
          distance_km?: number | null
          driver_id?: string | null
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_location: string
          fare?: number | null
          id?: string
          notes?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_location: string
          rider_id: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          updated_at?: string
          vehicle_type?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          completed_at?: string | null
          created_at?: string
          distance_km?: number | null
          driver_id?: string | null
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_location?: string
          fare?: number | null
          id?: string
          notes?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_location?: string
          rider_id?: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          updated_at?: string
          vehicle_type?: string | null
        }
        Relationships: []
      }
      saved_addresses: {
        Row: {
          address: string
          created_at: string
          id: string
          label: string
          lat: number | null
          lng: number | null
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          label?: string
          lat?: number | null
          lng?: number | null
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          label?: string
          lat?: number | null
          lng?: number | null
          user_id?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string
          features: Json | null
          id: string
          is_active: boolean
          name: string
          price: number
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          features?: Json | null
          id?: string
          is_active?: boolean
          name: string
          price: number
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          features?: Json | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          plan_id: string
          starts_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          plan_id: string
          starts_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          plan_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      notify_user: {
        Args: {
          _message: string
          _title: string
          _type?: string
          _user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      account_status: "pending" | "approved" | "rejected" | "blocked"
      app_role: "rider" | "driver" | "restaurant" | "garage" | "admin"
      food_order_status:
        | "pending"
        | "confirmed"
        | "preparing"
        | "ready"
        | "picked_up"
        | "on_the_way"
        | "delivered"
        | "cancelled"
      parcel_status:
        | "pending"
        | "picked_up"
        | "in_transit"
        | "delivered"
        | "cancelled"
        | "driver_assigned"
        | "driver_arriving"
        | "arrived_destination"
        | "otp_verified"
      ride_status:
        | "pending"
        | "accepted"
        | "in_progress"
        | "completed"
        | "cancelled"
      subscription_status: "active" | "expired" | "cancelled"
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
    Enums: {
      account_status: ["pending", "approved", "rejected", "blocked"],
      app_role: ["rider", "driver", "restaurant", "garage", "admin"],
      food_order_status: [
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "picked_up",
        "on_the_way",
        "delivered",
        "cancelled",
      ],
      parcel_status: [
        "pending",
        "picked_up",
        "in_transit",
        "delivered",
        "cancelled",
        "driver_assigned",
        "driver_arriving",
        "arrived_destination",
        "otp_verified",
      ],
      ride_status: [
        "pending",
        "accepted",
        "in_progress",
        "completed",
        "cancelled",
      ],
      subscription_status: ["active", "expired", "cancelled"],
    },
  },
} as const
