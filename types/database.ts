import type { UserPlan, UserRole } from "@/types/auth";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          company_name: string | null;
          job_title: string | null;
          country: string | null;
          time_zone: string | null;
          plan: UserPlan;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_status: string | null;
          subscription_price_id: string | null;
          subscription_current_period_end: string | null;
          cancel_at_period_end: boolean | null;
          role: UserRole;
          status: "active" | "suspended";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          company_name?: string | null;
          job_title?: string | null;
          country?: string | null;
          time_zone?: string | null;
          plan?: UserPlan;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string | null;
          subscription_price_id?: string | null;
          subscription_current_period_end?: string | null;
          cancel_at_period_end?: boolean | null;
          role?: UserRole;
          status?: "active" | "suspended";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          company_name?: string | null;
          job_title?: string | null;
          country?: string | null;
          time_zone?: string | null;
          plan?: UserPlan;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string | null;
          subscription_price_id?: string | null;
          subscription_current_period_end?: string | null;
          cancel_at_period_end?: boolean | null;
          role?: UserRole;
          status?: "active" | "suspended";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      usage_counters: {
        Row: {
          id: string;
          user_id: string;
          action: string;
          usage_count: number;
          period_start: string;
          period_end: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          action: string;
          usage_count?: number;
          period_start: string;
          period_end: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          action?: string;
          usage_count?: number;
          period_start?: string;
          period_end?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      scan_history: {
        Row: {
          id: string;
          user_id: string;
          target: string;
          target_type: "website" | "file";
          risk_score: number;
          status: "completed" | "processing" | "failed";
          duration_ms: number;
          findings_count: number;
          error_message: string | null;
          scan_token: string | null;
          report_data: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          target: string;
          target_type: "website" | "file";
          risk_score?: number;
          status?: "completed" | "processing" | "failed";
          duration_ms?: number;
          findings_count?: number;
          error_message?: string | null;
          scan_token?: string | null;
          report_data?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          target?: string;
          target_type?: "website" | "file";
          risk_score?: number;
          status?: "completed" | "processing" | "failed";
          duration_ms?: number;
          findings_count?: number;
          error_message?: string | null;
          scan_token?: string | null;
          report_data?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_notification_preferences: {
        Row: {
          user_id: string;
          scan_completed: boolean;
          high_risk_found: boolean;
          weekly_summary: boolean;
          billing_alerts: boolean;
          product_updates: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          scan_completed?: boolean;
          high_risk_found?: boolean;
          weekly_summary?: boolean;
          billing_alerts?: boolean;
          product_updates?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          scan_completed?: boolean;
          high_risk_found?: boolean;
          weekly_summary?: boolean;
          billing_alerts?: boolean;
          product_updates?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      account_deletion_requests: {
        Row: {
          id: string;
          user_id: string;
          email: string;
          reason: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          email: string;
          reason?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          email?: string;
          reason?: string | null;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      scan_assistant_messages: {
        Row: {
          id: string;
          scan_id: string;
          user_id: string;
          role: "user" | "assistant";
          content: string;
          source: "ai" | "deterministic" | null;
          tokens_used: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          scan_id: string;
          user_id: string;
          role: "user" | "assistant";
          content: string;
          source?: "ai" | "deterministic" | null;
          tokens_used?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          scan_id?: string;
          user_id?: string;
          role?: "user" | "assistant";
          content?: string;
          source?: "ai" | "deterministic" | null;
          tokens_used?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      security_monitors: {
        Row: {
          id: string;
          user_id: string;
          target_url: string;
          label: string | null;
          frequency: "daily" | "weekly" | "monthly";
          status: "active" | "paused";
          last_scan_at: string | null;
          next_scan_at: string | null;
          last_scan_id: string | null;
          last_risk_score: number | null;
          last_findings_hash: string | null;
          last_snapshot: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          target_url: string;
          label?: string | null;
          frequency: "daily" | "weekly" | "monthly";
          status?: "active" | "paused";
          last_scan_at?: string | null;
          next_scan_at?: string | null;
          last_scan_id?: string | null;
          last_risk_score?: number | null;
          last_findings_hash?: string | null;
          last_snapshot?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          target_url?: string;
          label?: string | null;
          frequency?: "daily" | "weekly" | "monthly";
          status?: "active" | "paused";
          last_scan_at?: string | null;
          next_scan_at?: string | null;
          last_scan_id?: string | null;
          last_risk_score?: number | null;
          last_findings_hash?: string | null;
          last_snapshot?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      monitor_runs: {
        Row: {
          id: string;
          monitor_id: string;
          user_id: string;
          scan_history_id: string | null;
          status: "completed" | "failed" | "skipped";
          risk_score: number | null;
          previous_risk_score: number | null;
          findings_hash: string | null;
          snapshot: Record<string, unknown> | null;
          changes: Record<string, unknown> | null;
          error_message: string | null;
          duration_ms: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          monitor_id: string;
          user_id: string;
          scan_history_id?: string | null;
          status: "completed" | "failed" | "skipped";
          risk_score?: number | null;
          previous_risk_score?: number | null;
          findings_hash?: string | null;
          snapshot?: Record<string, unknown> | null;
          changes?: Record<string, unknown> | null;
          error_message?: string | null;
          duration_ms?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          monitor_id?: string;
          user_id?: string;
          scan_history_id?: string | null;
          status?: "completed" | "failed" | "skipped";
          risk_score?: number | null;
          previous_risk_score?: number | null;
          findings_hash?: string | null;
          snapshot?: Record<string, unknown> | null;
          changes?: Record<string, unknown> | null;
          error_message?: string | null;
          duration_ms?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      monitor_events: {
        Row: {
          id: string;
          monitor_id: string;
          monitor_run_id: string | null;
          user_id: string;
          event_type: string;
          severity: "info" | "warning" | "critical";
          title: string;
          message: string;
          payload: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          monitor_id: string;
          monitor_run_id?: string | null;
          user_id: string;
          event_type: string;
          severity?: "info" | "warning" | "critical";
          title: string;
          message: string;
          payload?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          monitor_id?: string;
          monitor_run_id?: string | null;
          user_id?: string;
          event_type?: string;
          severity?: "info" | "warning" | "critical";
          title?: string;
          message?: string;
          payload?: Record<string, unknown> | null;
          created_at?: string;
        };
        Relationships: [];
      };
      user_notifications: {
        Row: {
          id: string;
          user_id: string;
          monitor_id: string | null;
          title: string;
          message: string;
          link: string | null;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          monitor_id?: string | null;
          title: string;
          message: string;
          link?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          monitor_id?: string | null;
          title?: string;
          message?: string;
          link?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      notification_queue: {
        Row: {
          id: string;
          user_id: string;
          monitor_id: string | null;
          channel: "email" | "in_app" | "webhook";
          event_type: string;
          payload: Record<string, unknown>;
          status: "pending" | "processing" | "sent" | "failed";
          error_message: string | null;
          created_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          monitor_id?: string | null;
          channel: "email" | "in_app" | "webhook";
          event_type: string;
          payload?: Record<string, unknown>;
          status?: "pending" | "processing" | "sent" | "failed";
          error_message?: string | null;
          created_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          monitor_id?: string | null;
          channel?: "email" | "in_app" | "webhook";
          event_type?: string;
          payload?: Record<string, unknown>;
          status?: "pending" | "processing" | "sent" | "failed";
          error_message?: string | null;
          created_at?: string;
          processed_at?: string | null;
        };
        Relationships: [];
      };
      monitor_job_queue: {
        Row: {
          id: string;
          monitor_id: string;
          user_id: string;
          status: "pending" | "processing" | "completed" | "failed";
          scheduled_for: string;
          attempts: number;
          error_message: string | null;
          created_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          monitor_id: string;
          user_id: string;
          status?: "pending" | "processing" | "completed" | "failed";
          scheduled_for?: string;
          attempts?: number;
          error_message?: string | null;
          created_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          monitor_id?: string;
          user_id?: string;
          status?: "pending" | "processing" | "completed" | "failed";
          scheduled_for?: string;
          attempts?: number;
          error_message?: string | null;
          created_at?: string;
          processed_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      consume_tool_usage: {
        Args: {
          p_user_id: string;
          p_action: string;
          p_period_start: string;
          p_period_end: string;
          p_limit: number;
        };
        Returns: {
          allowed: boolean;
          usage_count: number;
          limit: number;
          remaining: number;
        };
      };
      get_scan_history_summary: {
        Args: Record<string, never>;
        Returns: {
          total_scans: number;
          high_risk_scans: number;
          clean_scans: number;
          average_risk_score: number;
        };
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
