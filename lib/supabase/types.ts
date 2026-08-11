export type Database = {
  public: {
    Tables: {
      staff_profiles: {
        Row: {
          id: string;
          display_name: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["staff_profiles"]["Row"]> & {
          id: string;
          display_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["staff_profiles"]["Row"]>;
        Relationships: [];
      };
      report_periods: {
        Row: {
          id: string;
          staff_id: string;
          period_start: string;
          period_end: string;
          starting_float: number;
          transfer_base: number;
          transfer_manual_addition: number;
          status: "draft" | "finalized";
          computed_zangaku: number | null;
          generated_text: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["report_periods"]["Row"]> & {
          staff_id: string;
          period_start: string;
          period_end: string;
        };
        Update: Partial<Database["public"]["Tables"]["report_periods"]["Row"]>;
        Relationships: [];
      };
      purchases: {
        Row: {
          id: string;
          staff_id: string;
          report_period_id: string | null;
          amount: number;
          category: string | null;
          item_note: string | null;
          source: "manual" | "line";
          occurred_at: string;
          needs_review: boolean;
          line_message_id: string | null;
          image_urls: string[] | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["purchases"]["Row"]> & {
          staff_id: string;
          amount: number;
        };
        Update: Partial<Database["public"]["Tables"]["purchases"]["Row"]>;
        Relationships: [];
      };
      other_expenses: {
        Row: {
          id: string;
          staff_id: string;
          report_period_id: string | null;
          amount: number;
          description: string;
          expense_date: string;
          receipt_path: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["other_expenses"]["Row"]> & {
          staff_id: string;
          amount: number;
          description: string;
        };
        Update: Partial<Database["public"]["Tables"]["other_expenses"]["Row"]>;
        Relationships: [];
      };
      line_webhook_events: {
        Row: {
          id: string;
          line_message_id: string | null;
          line_group_id: string | null;
          raw_payload: unknown;
          parse_status: "parsed" | "needs_review" | "ignored";
          parsed_staff_name: string | null;
          resulting_purchase_id: string | null;
          received_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["line_webhook_events"]["Row"]> & {
          raw_payload: unknown;
          parse_status: "parsed" | "needs_review" | "ignored";
        };
        Update: Partial<Database["public"]["Tables"]["line_webhook_events"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
