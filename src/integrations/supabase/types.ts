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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      inventory_snapshots: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          product_id: string
          quantity: number
          snapshot_date: string
          unit_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          product_id: string
          quantity?: number
          snapshot_date: string
          unit_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string
          quantity?: number
          snapshot_date?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_snapshots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_snapshots_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      product_units: {
        Row: {
          created_at: string
          id: string
          product_id: string
          unit_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          unit_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_units_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_units_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          category_id: string | null
          code: string
          created_at: string
          customs_value: number | null
          dun_14: string | null
          ean_13: string | null
          fob_price_usd: number | null
          gross_weight: number | null
          id: string
          image_url: string | null
          individual_height: number | null
          individual_length: number | null
          individual_weight: number | null
          individual_width: number | null
          is_active: boolean
          item_type: string | null
          lead_time_days: number | null
          master_box_height: number | null
          master_box_length: number | null
          master_box_volume: number | null
          master_box_width: number | null
          moq: number | null
          ncm: string | null
          origin_description: string | null
          packaging_type: string | null
          product_height: number | null
          product_length: number | null
          product_width: number | null
          qty_inner: number | null
          qty_master_box: number | null
          subcategory_id: string | null
          supplier_id: string | null
          supplier_specs: string | null
          tax_cofins: number | null
          tax_icms: number | null
          tax_ii: number | null
          tax_ipi: number | null
          tax_pis: number | null
          technical_description: string
          unit_of_measure: Database["public"]["Enums"]["unit_of_measure"]
          updated_at: string
          warehouse_status: string | null
          weight_per_unit: number | null
        }
        Insert: {
          brand?: string | null
          category_id?: string | null
          code: string
          created_at?: string
          customs_value?: number | null
          dun_14?: string | null
          ean_13?: string | null
          fob_price_usd?: number | null
          gross_weight?: number | null
          id?: string
          image_url?: string | null
          individual_height?: number | null
          individual_length?: number | null
          individual_weight?: number | null
          individual_width?: number | null
          is_active?: boolean
          item_type?: string | null
          lead_time_days?: number | null
          master_box_height?: number | null
          master_box_length?: number | null
          master_box_volume?: number | null
          master_box_width?: number | null
          moq?: number | null
          ncm?: string | null
          origin_description?: string | null
          packaging_type?: string | null
          product_height?: number | null
          product_length?: number | null
          product_width?: number | null
          qty_inner?: number | null
          qty_master_box?: number | null
          subcategory_id?: string | null
          supplier_id?: string | null
          supplier_specs?: string | null
          tax_cofins?: number | null
          tax_icms?: number | null
          tax_ii?: number | null
          tax_ipi?: number | null
          tax_pis?: number | null
          technical_description: string
          unit_of_measure?: Database["public"]["Enums"]["unit_of_measure"]
          updated_at?: string
          warehouse_status?: string | null
          weight_per_unit?: number | null
        }
        Update: {
          brand?: string | null
          category_id?: string | null
          code?: string
          created_at?: string
          customs_value?: number | null
          dun_14?: string | null
          ean_13?: string | null
          fob_price_usd?: number | null
          gross_weight?: number | null
          id?: string
          image_url?: string | null
          individual_height?: number | null
          individual_length?: number | null
          individual_weight?: number | null
          individual_width?: number | null
          is_active?: boolean
          item_type?: string | null
          lead_time_days?: number | null
          master_box_height?: number | null
          master_box_length?: number | null
          master_box_volume?: number | null
          master_box_width?: number | null
          moq?: number | null
          ncm?: string | null
          origin_description?: string | null
          packaging_type?: string | null
          product_height?: number | null
          product_length?: number | null
          product_width?: number | null
          qty_inner?: number | null
          qty_master_box?: number | null
          subcategory_id?: string | null
          supplier_id?: string | null
          supplier_specs?: string | null
          tax_cofins?: number | null
          tax_icms?: number | null
          tax_ii?: number | null
          tax_ipi?: number | null
          tax_pis?: number | null
          technical_description?: string
          unit_of_measure?: Database["public"]["Enums"]["unit_of_measure"]
          updated_at?: string
          warehouse_status?: string | null
          weight_per_unit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          created_at: string
          expected_arrival: string | null
          id: string
          product_id: string
          purchase_order_id: string
          quantity: number
          unit_id: string
          unit_price_usd: number | null
        }
        Insert: {
          created_at?: string
          expected_arrival?: string | null
          id?: string
          product_id: string
          purchase_order_id: string
          quantity: number
          unit_id: string
          unit_price_usd?: number | null
        }
        Update: {
          created_at?: string
          expected_arrival?: string | null
          id?: string
          product_id?: string
          purchase_order_id?: string
          quantity?: number
          unit_id?: string
          unit_price_usd?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          order_date: string
          order_number: string
          status: string
          supplier_id: string
          total_value_usd: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number: string
          status?: string
          supplier_id: string
          total_value_usd?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string
          status?: string
          supplier_id?: string
          total_value_usd?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_forecasts: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          product_id: string
          quantity: number
          unit_id: string
          version: string
          year_month: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          product_id: string
          quantity?: number
          unit_id: string
          version?: string
          year_month: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string
          quantity?: number
          unit_id?: string
          version?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_forecasts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_forecasts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_history: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          product_id: string
          quantity: number
          unit_id: string
          year_month: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          product_id: string
          quantity?: number
          unit_id: string
          year_month: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string
          quantity?: number
          unit_id?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_history_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_arrivals: {
        Row: {
          arrival_date: string
          created_at: string | null
          created_by: string | null
          id: string
          product_id: string
          quantity: number
          source_file: string | null
          unit_id: string
        }
        Insert: {
          arrival_date: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          product_id: string
          quantity?: number
          source_file?: string | null
          unit_id: string
        }
        Update: {
          arrival_date?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          product_id?: string
          quantity?: number
          source_file?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_arrivals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_arrivals_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategories: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          avg_response_time_days: number | null
          certifications: string[] | null
          city: string | null
          company_name: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          payment_terms: string | null
          postal_code: string | null
          state_province: string | null
          tax_id: string | null
          trade_name: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          avg_response_time_days?: number | null
          certifications?: string[] | null
          city?: string | null
          company_name: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          payment_terms?: string | null
          postal_code?: string | null
          state_province?: string | null
          tax_id?: string | null
          trade_name?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          avg_response_time_days?: number | null
          certifications?: string[] | null
          city?: string | null
          company_name?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          payment_terms?: string | null
          postal_code?: string | null
          state_province?: string | null
          tax_id?: string | null
          trade_name?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      units: {
        Row: {
          address: string | null
          city: string | null
          cnpj: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          responsible_email: string | null
          responsible_name: string | null
          responsible_phone: string | null
          state: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          responsible_email?: string | null
          responsible_name?: string | null
          responsible_phone?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          responsible_email?: string | null
          responsible_name?: string | null
          responsible_phone?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
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
          role?: Database["public"]["Enums"]["app_role"]
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
      generate_purchase_order_number: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "buyer" | "viewer"
      unit_of_measure:
        | "pcs"
        | "kg"
        | "g"
        | "l"
        | "ml"
        | "m"
        | "cm"
        | "box"
        | "set"
        | "pair"
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
      app_role: ["admin", "buyer", "viewer"],
      unit_of_measure: [
        "pcs",
        "kg",
        "g",
        "l",
        "ml",
        "m",
        "cm",
        "box",
        "set",
        "pair",
      ],
    },
  },
} as const
