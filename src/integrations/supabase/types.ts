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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      anonymized_encounter: {
        Row: {
          age_bracket: string | null
          clinical_embedding: string | null
          clinical_history_icd_codes: Json
          day_of_week: string | null
          disposition: Database["public"]["Enums"]["disposition_enum"] | null
          encounter_date: string
          encounter_type:
            | Database["public"]["Enums"]["encounter_type_enum"]
            | null
          gender: string | null
          hour_of_day: number | null
          id: string
          industry: string | null
          is_pregnant: boolean
          month: number | null
          observations_loinc: Json
          postal_code: string | null
          prescription_atc_codes: Json
          primary_icd_10: string | null
          secondary_icd_10_codes: Json
          symptom_duration_category: string | null
          symptom_icd_codes: Json
          travel_history: Json
          urgency_level: Database["public"]["Enums"]["urgency_enum"] | null
          weather_conditions: Json
          year: number | null
        }
        Insert: {
          age_bracket?: string | null
          clinical_embedding?: string | null
          clinical_history_icd_codes?: Json
          day_of_week?: string | null
          disposition?: Database["public"]["Enums"]["disposition_enum"] | null
          encounter_date?: string
          encounter_type?:
            | Database["public"]["Enums"]["encounter_type_enum"]
            | null
          gender?: string | null
          hour_of_day?: number | null
          id?: string
          industry?: string | null
          is_pregnant?: boolean
          month?: number | null
          observations_loinc?: Json
          postal_code?: string | null
          prescription_atc_codes?: Json
          primary_icd_10?: string | null
          secondary_icd_10_codes?: Json
          symptom_duration_category?: string | null
          symptom_icd_codes?: Json
          travel_history?: Json
          urgency_level?: Database["public"]["Enums"]["urgency_enum"] | null
          weather_conditions?: Json
          year?: number | null
        }
        Update: {
          age_bracket?: string | null
          clinical_embedding?: string | null
          clinical_history_icd_codes?: Json
          day_of_week?: string | null
          disposition?: Database["public"]["Enums"]["disposition_enum"] | null
          encounter_date?: string
          encounter_type?:
            | Database["public"]["Enums"]["encounter_type_enum"]
            | null
          gender?: string | null
          hour_of_day?: number | null
          id?: string
          industry?: string | null
          is_pregnant?: boolean
          month?: number | null
          observations_loinc?: Json
          postal_code?: string | null
          prescription_atc_codes?: Json
          primary_icd_10?: string | null
          secondary_icd_10_codes?: Json
          symptom_duration_category?: string | null
          symptom_icd_codes?: Json
          travel_history?: Json
          urgency_level?: Database["public"]["Enums"]["urgency_enum"] | null
          weather_conditions?: Json
          year?: number | null
        }
        Relationships: []
      }
      clinical_record: {
        Row: {
          category: Database["public"]["Enums"]["record_category_enum"]
          code: string | null
          code_system: Database["public"]["Enums"]["code_system_enum"]
          created_at: string
          description: string
          id: string
          patient_id: string
          status: Database["public"]["Enums"]["record_status_enum"]
        }
        Insert: {
          category: Database["public"]["Enums"]["record_category_enum"]
          code?: string | null
          code_system?: Database["public"]["Enums"]["code_system_enum"]
          created_at?: string
          description: string
          id?: string
          patient_id: string
          status?: Database["public"]["Enums"]["record_status_enum"]
        }
        Update: {
          category?: Database["public"]["Enums"]["record_category_enum"]
          code?: string | null
          code_system?: Database["public"]["Enums"]["code_system_enum"]
          created_at?: string
          description?: string
          id?: string
          patient_id?: string
          status?: Database["public"]["Enums"]["record_status_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "clinical_record_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_grant: {
        Row: {
          created_at: string
          expires_at: string | null
          granted_at: string | null
          id: string
          is_emergency_override: boolean
          justification_notes: string | null
          patient_id: string
          practitioner_id: string
          status: Database["public"]["Enums"]["consent_status_enum"]
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          granted_at?: string | null
          id?: string
          is_emergency_override?: boolean
          justification_notes?: string | null
          patient_id: string
          practitioner_id: string
          status?: Database["public"]["Enums"]["consent_status_enum"]
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          granted_at?: string | null
          id?: string
          is_emergency_override?: boolean
          justification_notes?: string | null
          patient_id?: string
          practitioner_id?: string
          status?: Database["public"]["Enums"]["consent_status_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "consent_grant_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_grant_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "practitioner"
            referencedColumns: ["id"]
          },
        ]
      }
      drug_prescription: {
        Row: {
          atc_code: string | null
          clinical_record_id: string | null
          created_at: string
          dosage: string | null
          drug_name: string
          end_date: string | null
          frequency: string | null
          id: string
          patient_id: string
          start_date: string | null
          visit_id: string | null
        }
        Insert: {
          atc_code?: string | null
          clinical_record_id?: string | null
          created_at?: string
          dosage?: string | null
          drug_name: string
          end_date?: string | null
          frequency?: string | null
          id?: string
          patient_id: string
          start_date?: string | null
          visit_id?: string | null
        }
        Update: {
          atc_code?: string | null
          clinical_record_id?: string | null
          created_at?: string
          dosage?: string | null
          drug_name?: string
          end_date?: string | null
          frequency?: string | null
          id?: string
          patient_id?: string
          start_date?: string | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drug_prescription_clinical_record_id_fkey"
            columns: ["clinical_record_id"]
            isOneToOne: false
            referencedRelation: "clinical_record"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drug_prescription_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drug_prescription_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit"
            referencedColumns: ["id"]
          },
        ]
      }
      icd10_code_lookup: {
        Row: {
          chapter: string
          code: string
          description: string
        }
        Insert: {
          chapter: string
          code: string
          description: string
        }
        Update: {
          chapter?: string
          code?: string
          description?: string
        }
        Relationships: []
      }
      industry_lookup: {
        Row: {
          industry_name: string
        }
        Insert: {
          industry_name: string
        }
        Update: {
          industry_name?: string
        }
        Relationships: []
      }
      observation: {
        Row: {
          id: string
          loinc_code: string | null
          patient_id: string
          recorded_at: string
          source: string | null
          test_name: string
          unit: string | null
          value: number | null
          visit_id: string | null
        }
        Insert: {
          id?: string
          loinc_code?: string | null
          patient_id: string
          recorded_at?: string
          source?: string | null
          test_name: string
          unit?: string | null
          value?: number | null
          visit_id?: string | null
        }
        Update: {
          id?: string
          loinc_code?: string | null
          patient_id?: string
          recorded_at?: string
          source?: string | null
          test_name?: string
          unit?: string | null
          value?: number | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "observation_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observation_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit"
            referencedColumns: ["id"]
          },
        ]
      }
      organization: {
        Row: {
          created_at: string
          id: string
          name: string
          region: string
          type: Database["public"]["Enums"]["organization_type_enum"]
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          region: string
          type?: Database["public"]["Enums"]["organization_type_enum"]
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          region?: string
          type?: Database["public"]["Enums"]["organization_type_enum"]
        }
        Relationships: []
      }
      patient: {
        Row: {
          cpr_number: string | null
          created_at: string
          date_of_birth: string | null
          family_medical_history_icd_codes: Json
          full_name: string
          gender: string | null
          id: string
          industry: string | null
          postal_code: string | null
          primary_language: string
        }
        Insert: {
          cpr_number?: string | null
          created_at?: string
          date_of_birth?: string | null
          family_medical_history_icd_codes?: Json
          full_name: string
          gender?: string | null
          id?: string
          industry?: string | null
          postal_code?: string | null
          primary_language?: string
        }
        Update: {
          cpr_number?: string | null
          created_at?: string
          date_of_birth?: string | null
          family_medical_history_icd_codes?: Json
          full_name?: string
          gender?: string | null
          id?: string
          industry?: string | null
          postal_code?: string | null
          primary_language?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_industry_fkey"
            columns: ["industry"]
            isOneToOne: false
            referencedRelation: "industry_lookup"
            referencedColumns: ["industry_name"]
          },
        ]
      }
      patient_proxy: {
        Row: {
          expires_at: string | null
          granted_at: string
          id: string
          patient_id: string
          proxy_patient_id: string
          relationship: Database["public"]["Enums"]["proxy_relationship_enum"]
          status: Database["public"]["Enums"]["proxy_status_enum"]
        }
        Insert: {
          expires_at?: string | null
          granted_at?: string
          id?: string
          patient_id: string
          proxy_patient_id: string
          relationship: Database["public"]["Enums"]["proxy_relationship_enum"]
          status?: Database["public"]["Enums"]["proxy_status_enum"]
        }
        Update: {
          expires_at?: string | null
          granted_at?: string
          id?: string
          patient_id?: string
          proxy_patient_id?: string
          relationship?: Database["public"]["Enums"]["proxy_relationship_enum"]
          status?: Database["public"]["Enums"]["proxy_status_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "patient_proxy_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_proxy_proxy_patient_id_fkey"
            columns: ["proxy_patient_id"]
            isOneToOne: false
            referencedRelation: "patient"
            referencedColumns: ["id"]
          },
        ]
      }
      practitioner: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_verified: boolean
          license_number: string | null
          organization_id: string | null
          role: Database["public"]["Enums"]["practitioner_role_enum"]
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          is_verified?: boolean
          license_number?: string | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["practitioner_role_enum"]
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_verified?: boolean
          license_number?: string | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["practitioner_role_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "practitioner_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          patient_id: string | null
          practitioner_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          patient_id?: string | null
          practitioner_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          patient_id?: string | null
          practitioner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patient"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: true
            referencedRelation: "practitioner"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visit: {
        Row: {
          conclusion: string | null
          created_at: string
          disposition: Database["public"]["Enums"]["disposition_enum"] | null
          encounter_type: Database["public"]["Enums"]["encounter_type_enum"]
          id: string
          intake_transcript: string | null
          is_ai_generated: boolean
          is_pregnant: boolean
          patient_id: string
          practitioner_id: string | null
          recommendation: string | null
          status: Database["public"]["Enums"]["visit_status_enum"]
          symptom_duration_days: number | null
          symptom_icd_codes: Json
          symptoms: string | null
          travel_history: Json
          urgency_level: Database["public"]["Enums"]["urgency_enum"]
          visit_date: string
        }
        Insert: {
          conclusion?: string | null
          created_at?: string
          disposition?: Database["public"]["Enums"]["disposition_enum"] | null
          encounter_type?: Database["public"]["Enums"]["encounter_type_enum"]
          id?: string
          intake_transcript?: string | null
          is_ai_generated?: boolean
          is_pregnant?: boolean
          patient_id: string
          practitioner_id?: string | null
          recommendation?: string | null
          status?: Database["public"]["Enums"]["visit_status_enum"]
          symptom_duration_days?: number | null
          symptom_icd_codes?: Json
          symptoms?: string | null
          travel_history?: Json
          urgency_level?: Database["public"]["Enums"]["urgency_enum"]
          visit_date?: string
        }
        Update: {
          conclusion?: string | null
          created_at?: string
          disposition?: Database["public"]["Enums"]["disposition_enum"] | null
          encounter_type?: Database["public"]["Enums"]["encounter_type_enum"]
          id?: string
          intake_transcript?: string | null
          is_ai_generated?: boolean
          is_pregnant?: boolean
          patient_id?: string
          practitioner_id?: string | null
          recommendation?: string | null
          status?: Database["public"]["Enums"]["visit_status_enum"]
          symptom_duration_days?: number | null
          symptom_icd_codes?: Json
          symptoms?: string | null
          travel_history?: Json
          urgency_level?: Database["public"]["Enums"]["urgency_enum"]
          visit_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "practitioner"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_clinical_record: {
        Row: {
          clinical_record_id: string
          role_in_visit: Database["public"]["Enums"]["role_in_visit_enum"]
          visit_id: string
        }
        Insert: {
          clinical_record_id: string
          role_in_visit?: Database["public"]["Enums"]["role_in_visit_enum"]
          visit_id: string
        }
        Update: {
          clinical_record_id?: string
          role_in_visit?: Database["public"]["Enums"]["role_in_visit_enum"]
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_clinical_record_clinical_record_id_fkey"
            columns: ["clinical_record_id"]
            isOneToOne: false
            referencedRelation: "clinical_record"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_clinical_record_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_read_patient: { Args: { _patient_id: string }; Returns: boolean }
      claim_demo_identity: { Args: never; Returns: undefined }
      current_patient_id: { Args: never; Returns: string }
      current_practitioner_id: { Args: never; Returns: string }
      has_consent: { Args: { _patient_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "PATIENT" | "PRACTITIONER" | "ANALYST"
      code_system_enum: "SKS" | "ICD10" | "ICPC2" | "SNOMED" | "LOINC" | "ATC"
      consent_status_enum: "PENDING" | "ACTIVE" | "REVOKED" | "EXPIRED"
      disposition_enum: "HOME_CARE" | "PRESCRIPTION" | "ER_REFERRAL"
      encounter_type_enum: "NEW_ISSUE" | "FOLLOW_UP" | "CHRONIC_FLARE_UP"
      organization_type_enum: "HOSPITAL" | "GP_CLINIC" | "SPECIALIST"
      practitioner_role_enum: "DOCTOR" | "NURSE" | "ADMIN"
      proxy_relationship_enum: "PARENT" | "GUARDIAN" | "SPOUSE" | "POA"
      proxy_status_enum: "ACTIVE" | "REVOKED"
      record_category_enum: "CONDITION" | "PROCEDURE" | "ALLERGY" | "REFERRAL"
      record_status_enum: "ACTIVE" | "RESOLVED" | "SUSPECTED"
      role_in_visit_enum: "REASON_FOR_VISIT" | "DIAGNOSED" | "FOLLOW_UP"
      urgency_enum: "LOW" | "MEDIUM" | "HIGH_RED_FLAG"
      visit_status_enum: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED"
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
      app_role: ["PATIENT", "PRACTITIONER", "ANALYST"],
      code_system_enum: ["SKS", "ICD10", "ICPC2", "SNOMED", "LOINC", "ATC"],
      consent_status_enum: ["PENDING", "ACTIVE", "REVOKED", "EXPIRED"],
      disposition_enum: ["HOME_CARE", "PRESCRIPTION", "ER_REFERRAL"],
      encounter_type_enum: ["NEW_ISSUE", "FOLLOW_UP", "CHRONIC_FLARE_UP"],
      organization_type_enum: ["HOSPITAL", "GP_CLINIC", "SPECIALIST"],
      practitioner_role_enum: ["DOCTOR", "NURSE", "ADMIN"],
      proxy_relationship_enum: ["PARENT", "GUARDIAN", "SPOUSE", "POA"],
      proxy_status_enum: ["ACTIVE", "REVOKED"],
      record_category_enum: ["CONDITION", "PROCEDURE", "ALLERGY", "REFERRAL"],
      record_status_enum: ["ACTIVE", "RESOLVED", "SUSPECTED"],
      role_in_visit_enum: ["REASON_FOR_VISIT", "DIAGNOSED", "FOLLOW_UP"],
      urgency_enum: ["LOW", "MEDIUM", "HIGH_RED_FLAG"],
      visit_status_enum: ["SCHEDULED", "IN_PROGRESS", "COMPLETED"],
    },
  },
} as const
