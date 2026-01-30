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
      card_user_views: {
        Row: {
          card_id: string
          id: string
          last_viewed_at: string
          user_id: string
        }
        Insert: {
          card_id: string
          id?: string
          last_viewed_at?: string
          user_id: string
        }
        Update: {
          card_id?: string
          id?: string
          last_viewed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_user_views_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "development_items"
            referencedColumns: ["id"]
          },
        ]
      }
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
      development_card_activity: {
        Row: {
          activity_type: string
          card_id: string
          content: string | null
          created_at: string
          id: string
          metadata: Json | null
          pending_for_team: string | null
          thread_id: string | null
          thread_resolved_at: string | null
          thread_root_id: string | null
          thread_title: string | null
          user_id: string
        }
        Insert: {
          activity_type: string
          card_id: string
          content?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          pending_for_team?: string | null
          thread_id?: string | null
          thread_resolved_at?: string | null
          thread_root_id?: string | null
          thread_title?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string
          card_id?: string
          content?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          pending_for_team?: string | null
          thread_id?: string | null
          thread_resolved_at?: string | null
          thread_root_id?: string | null
          thread_title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_card_activity_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "development_items"
            referencedColumns: ["id"]
          },
        ]
      }
      development_card_products: {
        Row: {
          card_id: string
          created_at: string
          created_by: string
          id: string
          image_url: string | null
          notes: string | null
          product_code: string
          product_name: string | null
        }
        Insert: {
          card_id: string
          created_at?: string
          created_by: string
          id?: string
          image_url?: string | null
          notes?: string | null
          product_code: string
          product_name?: string | null
        }
        Update: {
          card_id?: string
          created_at?: string
          created_by?: string
          id?: string
          image_url?: string | null
          notes?: string | null
          product_code?: string
          product_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "development_card_products_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "development_items"
            referencedColumns: ["id"]
          },
        ]
      }
      development_item_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          item_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          item_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_item_comments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "development_items"
            referencedColumns: ["id"]
          },
        ]
      }
      development_item_samples: {
        Row: {
          actual_arrival: string | null
          courier_name: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision: string | null
          decision_notes: string | null
          estimated_arrival: string | null
          id: string
          item_id: string
          notes: string | null
          quantity: number | null
          report_url: string | null
          shipped_date: string | null
          status: Database["public"]["Enums"]["sample_shipment_status"] | null
          tracking_number: string | null
        }
        Insert: {
          actual_arrival?: string | null
          courier_name?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          decision_notes?: string | null
          estimated_arrival?: string | null
          id?: string
          item_id: string
          notes?: string | null
          quantity?: number | null
          report_url?: string | null
          shipped_date?: string | null
          status?: Database["public"]["Enums"]["sample_shipment_status"] | null
          tracking_number?: string | null
        }
        Update: {
          actual_arrival?: string | null
          courier_name?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          decision_notes?: string | null
          estimated_arrival?: string | null
          id?: string
          item_id?: string
          notes?: string | null
          quantity?: number | null
          report_url?: string | null
          shipped_date?: string | null
          status?: Database["public"]["Enums"]["sample_shipment_status"] | null
          tracking_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "development_item_samples_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "development_items"
            referencedColumns: ["id"]
          },
        ]
      }
      development_items: {
        Row: {
          assigned_to: string | null
          card_type: Database["public"]["Enums"]["development_card_type"] | null
          container_type: string | null
          created_at: string
          created_by: string
          created_by_role: string | null
          current_owner: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          due_date: string | null
          fob_price_usd: number | null
          id: string
          image_url: string | null
          is_new_for_other_team: boolean | null
          is_solved: boolean | null
          item_type: Database["public"]["Enums"]["development_item_type"] | null
          moq: number | null
          pending_action_due_at: string | null
          pending_action_snoozed_by: string | null
          pending_action_snoozed_until: string | null
          pending_action_type: string | null
          position: number | null
          priority:
            | Database["public"]["Enums"]["development_item_priority"]
            | null
          product_category:
            | Database["public"]["Enums"]["development_product_category"]
            | null
          product_code: string | null
          qty_per_container: number | null
          status: Database["public"]["Enums"]["development_item_status"]
          supplier_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          card_type?:
            | Database["public"]["Enums"]["development_card_type"]
            | null
          container_type?: string | null
          created_at?: string
          created_by: string
          created_by_role?: string | null
          current_owner?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          due_date?: string | null
          fob_price_usd?: number | null
          id?: string
          image_url?: string | null
          is_new_for_other_team?: boolean | null
          is_solved?: boolean | null
          item_type?:
            | Database["public"]["Enums"]["development_item_type"]
            | null
          moq?: number | null
          pending_action_due_at?: string | null
          pending_action_snoozed_by?: string | null
          pending_action_snoozed_until?: string | null
          pending_action_type?: string | null
          position?: number | null
          priority?:
            | Database["public"]["Enums"]["development_item_priority"]
            | null
          product_category?:
            | Database["public"]["Enums"]["development_product_category"]
            | null
          product_code?: string | null
          qty_per_container?: number | null
          status?: Database["public"]["Enums"]["development_item_status"]
          supplier_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          card_type?:
            | Database["public"]["Enums"]["development_card_type"]
            | null
          container_type?: string | null
          created_at?: string
          created_by?: string
          created_by_role?: string | null
          current_owner?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          due_date?: string | null
          fob_price_usd?: number | null
          id?: string
          image_url?: string | null
          is_new_for_other_team?: boolean | null
          is_solved?: boolean | null
          item_type?:
            | Database["public"]["Enums"]["development_item_type"]
            | null
          moq?: number | null
          pending_action_due_at?: string | null
          pending_action_snoozed_by?: string | null
          pending_action_snoozed_until?: string | null
          pending_action_type?: string | null
          position?: number | null
          priority?:
            | Database["public"]["Enums"]["development_item_priority"]
            | null
          product_category?:
            | Database["public"]["Enums"]["development_product_category"]
            | null
          product_code?: string | null
          qty_per_container?: number | null
          status?: Database["public"]["Enums"]["development_item_status"]
          supplier_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_health_summary"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "development_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
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
      notifications: {
        Row: {
          activity_id: string | null
          card_id: string | null
          content: string | null
          created_at: string
          id: string
          is_read: boolean
          read_at: string | null
          title: string
          triggered_by: string
          type: string
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          card_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          read_at?: string | null
          title: string
          triggered_by: string
          type: string
          user_id: string
        }
        Update: {
          activity_id?: string | null
          card_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          read_at?: string | null
          title?: string
          triggered_by?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "development_card_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "development_items"
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
            referencedRelation: "supplier_health_summary"
            referencedColumns: ["supplier_id"]
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
      purchase_order_change_history: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          change_type: string
          changed_at: string
          changed_by: string
          field_name: string
          id: string
          is_critical: boolean | null
          new_value: string | null
          old_value: string | null
          purchase_order_id: string
          purchase_order_item_id: string | null
          requires_approval: boolean | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          change_type: string
          changed_at?: string
          changed_by: string
          field_name: string
          id?: string
          is_critical?: boolean | null
          new_value?: string | null
          old_value?: string | null
          purchase_order_id: string
          purchase_order_item_id?: string | null
          requires_approval?: boolean | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          change_type?: string
          changed_at?: string
          changed_by?: string
          field_name?: string
          id?: string
          is_critical?: boolean | null
          new_value?: string | null
          old_value?: string | null
          purchase_order_id?: string
          purchase_order_item_id?: string | null
          requires_approval?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_change_history_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_change_history_purchase_order_item_id_fkey"
            columns: ["purchase_order_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string
          expected_arrival: string | null
          id: string
          product_id: string
          purchase_order_id: string
          quantity: number
          trader_price_approved: boolean | null
          trader_quantity_approved: boolean | null
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
          trader_price_approved?: boolean | null
          trader_quantity_approved?: boolean | null
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
          trader_price_approved?: boolean | null
          trader_quantity_approved?: boolean | null
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
          buyer_approval_notes: string | null
          crd: string | null
          created_at: string
          created_by: string | null
          etd: string | null
          id: string
          invoice_number: string | null
          notes: string | null
          order_date: string
          order_number: string
          payment_terms: string | null
          port_destination: string | null
          port_origin: string | null
          reference_number: string | null
          requires_buyer_approval: boolean | null
          status: string
          supplier_id: string
          total_value_usd: number | null
          trader_etd_approved: boolean | null
          trader_etd_approved_at: string | null
          trader_etd_approved_by: string | null
          trader_prices_approved: boolean | null
          trader_prices_approved_at: string | null
          trader_prices_approved_by: string | null
          trader_quantities_approved: boolean | null
          trader_quantities_approved_at: string | null
          trader_quantities_approved_by: string | null
          updated_at: string
        }
        Insert: {
          buyer_approval_notes?: string | null
          crd?: string | null
          created_at?: string
          created_by?: string | null
          etd?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          order_date?: string
          order_number: string
          payment_terms?: string | null
          port_destination?: string | null
          port_origin?: string | null
          reference_number?: string | null
          requires_buyer_approval?: boolean | null
          status?: string
          supplier_id: string
          total_value_usd?: number | null
          trader_etd_approved?: boolean | null
          trader_etd_approved_at?: string | null
          trader_etd_approved_by?: string | null
          trader_prices_approved?: boolean | null
          trader_prices_approved_at?: string | null
          trader_prices_approved_by?: string | null
          trader_quantities_approved?: boolean | null
          trader_quantities_approved_at?: string | null
          trader_quantities_approved_by?: string | null
          updated_at?: string
        }
        Update: {
          buyer_approval_notes?: string | null
          crd?: string | null
          created_at?: string
          created_by?: string | null
          etd?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          order_date?: string
          order_number?: string
          payment_terms?: string | null
          port_destination?: string | null
          port_origin?: string | null
          reference_number?: string | null
          requires_buyer_approval?: boolean | null
          status?: string
          supplier_id?: string
          total_value_usd?: number | null
          trader_etd_approved?: boolean | null
          trader_etd_approved_at?: string | null
          trader_etd_approved_by?: string | null
          trader_prices_approved?: boolean | null
          trader_prices_approved_at?: string | null
          trader_prices_approved_by?: string | null
          trader_quantities_approved?: boolean | null
          trader_quantities_approved_at?: string | null
          trader_quantities_approved_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_health_summary"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      role_card_colors: {
        Row: {
          color_hex: string
          created_at: string | null
          id: string
          label: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
        }
        Insert: {
          color_hex?: string
          created_at?: string | null
          id?: string
          label: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Update: {
          color_hex?: string
          created_at?: string | null
          id?: string
          label?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Relationships: []
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
          process_number: string | null
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
          process_number?: string | null
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
          process_number?: string | null
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
          bank_account: string | null
          bank_address: string | null
          bank_name: string | null
          bank_swift: string | null
          certifications: string[] | null
          city: string | null
          company_name: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          container_20_cbm: number | null
          container_40_cbm: number | null
          container_40hq_cbm: number | null
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
          bank_account?: string | null
          bank_address?: string | null
          bank_name?: string | null
          bank_swift?: string | null
          certifications?: string[] | null
          city?: string | null
          company_name: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          container_20_cbm?: number | null
          container_40_cbm?: number | null
          container_40hq_cbm?: number | null
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
          bank_account?: string | null
          bank_address?: string | null
          bank_name?: string | null
          bank_swift?: string | null
          certifications?: string[] | null
          city?: string | null
          company_name?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          container_20_cbm?: number | null
          container_40_cbm?: number | null
          container_40hq_cbm?: number | null
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
          estabelecimento_code: number | null
          fax: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
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
          estabelecimento_code?: number | null
          fax?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
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
          estabelecimento_code?: number | null
          fax?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
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
      supplier_health_summary: {
        Row: {
          alert_count: number | null
          attention_count: number | null
          calculated_at: string | null
          company_name: string | null
          country: string | null
          critical_count: number | null
          ok_count: number | null
          overall_status: string | null
          ruptured_products: Json | null
          supplier_id: string | null
          total_products: number | null
        }
        Relationships: []
      }
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
      refresh_supplier_health_summary: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role:
        | "admin"
        | "buyer"
        | "viewer"
        | "trader"
        | "quality"
        | "marketing"
      development_card_status: "pending" | "in_progress" | "waiting" | "solved"
      development_card_type: "item" | "item_group" | "task"
      development_item_priority: "low" | "medium" | "high" | "urgent"
      development_item_status:
        | "backlog"
        | "in_progress"
        | "waiting_supplier"
        | "sample_requested"
        | "sample_in_transit"
        | "sample_received"
        | "under_review"
        | "approved"
        | "rejected"
      development_item_type: "new_item" | "sample" | "development"
      development_product_category: "final_product" | "raw_material"
      sample_shipment_status:
        | "pending"
        | "in_transit"
        | "delivered"
        | "returned"
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
      app_role: ["admin", "buyer", "viewer", "trader", "quality", "marketing"],
      development_card_status: ["pending", "in_progress", "waiting", "solved"],
      development_card_type: ["item", "item_group", "task"],
      development_item_priority: ["low", "medium", "high", "urgent"],
      development_item_status: [
        "backlog",
        "in_progress",
        "waiting_supplier",
        "sample_requested",
        "sample_in_transit",
        "sample_received",
        "under_review",
        "approved",
        "rejected",
      ],
      development_item_type: ["new_item", "sample", "development"],
      development_product_category: ["final_product", "raw_material"],
      sample_shipment_status: [
        "pending",
        "in_transit",
        "delivered",
        "returned",
      ],
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
