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
          employment_status:
            | Database["public"]["Enums"]["employment_status_enum"]
            | null
          encounter_date: string
          encounter_type:
            | Database["public"]["Enums"]["encounter_type_enum"]
            | null
          gender: string | null
          gender_identity:
            | Database["public"]["Enums"]["gender_identity_enum"]
            | null
          hour_of_day: number | null
          id: string
          industry: string | null
          insurance_type:
            | Database["public"]["Enums"]["insurance_type_enum"]
            | null
          is_pregnant: boolean
          marital_status:
            | Database["public"]["Enums"]["marital_status_enum"]
            | null
          month: number | null
          observations_loinc: Json
          postal_code: string | null
          prescription_atc_codes: Json
          primary_icd_10: string | null
          primary_language: string | null
          race_ethnicity: string[]
          secondary_icd_10_codes: Json
          sex: Database["public"]["Enums"]["sex_enum"] | null
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
          employment_status?:
            | Database["public"]["Enums"]["employment_status_enum"]
            | null
          encounter_date?: string
          encounter_type?:
            | Database["public"]["Enums"]["encounter_type_enum"]
            | null
          gender?: string | null
          gender_identity?:
            | Database["public"]["Enums"]["gender_identity_enum"]
            | null
          hour_of_day?: number | null
          id?: string
          industry?: string | null
          insurance_type?:
            | Database["public"]["Enums"]["insurance_type_enum"]
            | null
          is_pregnant?: boolean
          marital_status?:
            | Database["public"]["Enums"]["marital_status_enum"]
            | null
          month?: number | null
          observations_loinc?: Json
          postal_code?: string | null
          prescription_atc_codes?: Json
          primary_icd_10?: string | null
          primary_language?: string | null
          race_ethnicity?: string[]
          secondary_icd_10_codes?: Json
          sex?: Database["public"]["Enums"]["sex_enum"] | null
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
          employment_status?:
            | Database["public"]["Enums"]["employment_status_enum"]
            | null
          encounter_date?: string
          encounter_type?:
            | Database["public"]["Enums"]["encounter_type_enum"]
            | null
          gender?: string | null
          gender_identity?:
            | Database["public"]["Enums"]["gender_identity_enum"]
            | null
          hour_of_day?: number | null
          id?: string
          industry?: string | null
          insurance_type?:
            | Database["public"]["Enums"]["insurance_type_enum"]
            | null
          is_pregnant?: boolean
          marital_status?:
            | Database["public"]["Enums"]["marital_status_enum"]
            | null
          month?: number | null
          observations_loinc?: Json
          postal_code?: string | null
          prescription_atc_codes?: Json
          primary_icd_10?: string | null
          primary_language?: string | null
          race_ethnicity?: string[]
          secondary_icd_10_codes?: Json
          sex?: Database["public"]["Enums"]["sex_enum"] | null
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
          visit_id: string | null
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
          visit_id?: string | null
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
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_record_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_record_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit"
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
          employment_status:
            | Database["public"]["Enums"]["employment_status_enum"]
            | null
          family_medical_history_icd_codes: Json
          first_name: string | null
          full_name: string
          gender_identity:
            | Database["public"]["Enums"]["gender_identity_enum"]
            | null
          id: string
          industry: string | null
          insurance_member_id: string | null
          insurance_provider: string | null
          insurance_type:
            | Database["public"]["Enums"]["insurance_type_enum"]
            | null
          last_name: string | null
          marital_status:
            | Database["public"]["Enums"]["marital_status_enum"]
            | null
          phone_number: string | null
          postal_code: string | null
          preferred_name: string | null
          primary_language: string
          race_ethnicity: string[]
          sex: Database["public"]["Enums"]["sex_enum"] | null
        }
        Insert: {
          cpr_number?: string | null
          created_at?: string
          date_of_birth?: string | null
          employment_status?:
            | Database["public"]["Enums"]["employment_status_enum"]
            | null
          family_medical_history_icd_codes?: Json
          first_name?: string | null
          full_name: string
          gender_identity?:
            | Database["public"]["Enums"]["gender_identity_enum"]
            | null
          id?: string
          industry?: string | null
          insurance_member_id?: string | null
          insurance_provider?: string | null
          insurance_type?:
            | Database["public"]["Enums"]["insurance_type_enum"]
            | null
          last_name?: string | null
          marital_status?:
            | Database["public"]["Enums"]["marital_status_enum"]
            | null
          phone_number?: string | null
          postal_code?: string | null
          preferred_name?: string | null
          primary_language?: string
          race_ethnicity?: string[]
          sex?: Database["public"]["Enums"]["sex_enum"] | null
        }
        Update: {
          cpr_number?: string | null
          created_at?: string
          date_of_birth?: string | null
          employment_status?:
            | Database["public"]["Enums"]["employment_status_enum"]
            | null
          family_medical_history_icd_codes?: Json
          first_name?: string | null
          full_name?: string
          gender_identity?:
            | Database["public"]["Enums"]["gender_identity_enum"]
            | null
          id?: string
          industry?: string | null
          insurance_member_id?: string | null
          insurance_provider?: string | null
          insurance_type?:
            | Database["public"]["Enums"]["insurance_type_enum"]
            | null
          last_name?: string | null
          marital_status?:
            | Database["public"]["Enums"]["marital_status_enum"]
            | null
          phone_number?: string | null
          postal_code?: string | null
          preferred_name?: string | null
          primary_language?: string
          race_ethnicity?: string[]
          sex?: Database["public"]["Enums"]["sex_enum"] | null
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
      patient_care_team: {
        Row: {
          assigned_at: string
          created_at: string
          ended_at: string | null
          id: string
          is_primary: boolean
          notes: string | null
          patient_id: string
          practitioner_id: string
          specialization: string
          status: Database["public"]["Enums"]["care_team_status_enum"]
        }
        Insert: {
          assigned_at?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          is_primary?: boolean
          notes?: string | null
          patient_id: string
          practitioner_id: string
          specialization: string
          status?: Database["public"]["Enums"]["care_team_status_enum"]
        }
        Update: {
          assigned_at?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          is_primary?: boolean
          notes?: string | null
          patient_id?: string
          practitioner_id?: string
          specialization?: string
          status?: Database["public"]["Enums"]["care_team_status_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "patient_care_team_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_care_team_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "practitioner"
            referencedColumns: ["id"]
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
          first_name: string | null
          full_name: string
          id: string
          is_verified: boolean
          last_name: string | null
          license_number: string | null
          organization_id: string | null
          role: Database["public"]["Enums"]["practitioner_role_enum"]
          specialization: string | null
          title: string | null
        }
        Insert: {
          created_at?: string
          first_name?: string | null
          full_name: string
          id?: string
          is_verified?: boolean
          last_name?: string | null
          license_number?: string | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["practitioner_role_enum"]
          specialization?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string
          first_name?: string | null
          full_name?: string
          id?: string
          is_verified?: boolean
          last_name?: string | null
          license_number?: string | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["practitioner_role_enum"]
          specialization?: string | null
          title?: string | null
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
      queue_priority: {
        Row: {
          id: string
          pinned: boolean
          position: number
          practitioner_id: string
          rationale: string | null
          updated_at: string
          visit_id: string
        }
        Insert: {
          id?: string
          pinned?: boolean
          position?: number
          practitioner_id: string
          rationale?: string | null
          updated_at?: string
          visit_id: string
        }
        Update: {
          id?: string
          pinned?: boolean
          position?: number
          practitioner_id?: string
          rationale?: string | null
          updated_at?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "queue_priority_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "practitioner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_priority_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit"
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
          arrived_at: string | null
          completed_at: string | null
          conclusion: string | null
          created_at: string
          disposition: Database["public"]["Enums"]["disposition_enum"] | null
          encounter_type: Database["public"]["Enums"]["encounter_type_enum"]
          id: string
          intake_transcript: string | null
          is_ai_generated: boolean
          is_pregnant: boolean
          patient_id: string
          patient_summary: string | null
          practitioner_id: string | null
          recommendation: string | null
          status: Database["public"]["Enums"]["visit_status_enum"]
          symptom_duration_days: number | null
          symptom_icd_codes: Json
          symptoms: string | null
          taken_in_at: string | null
          travel_history: Json
          urgency_level: Database["public"]["Enums"]["urgency_enum"]
          visit_date: string
          visit_transcript: string | null
        }
        Insert: {
          arrived_at?: string | null
          completed_at?: string | null
          conclusion?: string | null
          created_at?: string
          disposition?: Database["public"]["Enums"]["disposition_enum"] | null
          encounter_type?: Database["public"]["Enums"]["encounter_type_enum"]
          id?: string
          intake_transcript?: string | null
          is_ai_generated?: boolean
          is_pregnant?: boolean
          patient_id: string
          patient_summary?: string | null
          practitioner_id?: string | null
          recommendation?: string | null
          status?: Database["public"]["Enums"]["visit_status_enum"]
          symptom_duration_days?: number | null
          symptom_icd_codes?: Json
          symptoms?: string | null
          taken_in_at?: string | null
          travel_history?: Json
          urgency_level?: Database["public"]["Enums"]["urgency_enum"]
          visit_date?: string
          visit_transcript?: string | null
        }
        Update: {
          arrived_at?: string | null
          completed_at?: string | null
          conclusion?: string | null
          created_at?: string
          disposition?: Database["public"]["Enums"]["disposition_enum"] | null
          encounter_type?: Database["public"]["Enums"]["encounter_type_enum"]
          id?: string
          intake_transcript?: string | null
          is_ai_generated?: boolean
          is_pregnant?: boolean
          patient_id?: string
          patient_summary?: string | null
          practitioner_id?: string | null
          recommendation?: string | null
          status?: Database["public"]["Enums"]["visit_status_enum"]
          symptom_duration_days?: number | null
          symptom_icd_codes?: Json
          symptoms?: string | null
          taken_in_at?: string | null
          travel_history?: Json
          urgency_level?: Database["public"]["Enums"]["urgency_enum"]
          visit_date?: string
          visit_transcript?: string | null
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
      apply_onboarding:
        | {
            Args: {
              _full_name?: string
              _license?: string
              _practitioner_role?: Database["public"]["Enums"]["practitioner_role_enum"]
              _role: Database["public"]["Enums"]["app_role"]
              _verified?: boolean
            }
            Returns: undefined
          }
        | {
            Args: {
              _first_name?: string
              _full_name?: string
              _last_name?: string
              _license?: string
              _practitioner_role?: Database["public"]["Enums"]["practitioner_role_enum"]
              _role: Database["public"]["Enums"]["app_role"]
              _specialization?: string
              _title?: string
              _verified?: boolean
            }
            Returns: undefined
          }
        | {
            Args: {
              _first_name?: string
              _full_name?: string
              _last_name?: string
              _license?: string
              _phone?: string
              _practitioner_role?: Database["public"]["Enums"]["practitioner_role_enum"]
              _role: Database["public"]["Enums"]["app_role"]
              _specialization?: string
              _title?: string
              _verified?: boolean
            }
            Returns: undefined
          }
      break_glass_by_cpr: {
        Args: { _cpr: string; _duration: string; _justification: string }
        Returns: Json
      }
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
      owns_visit: { Args: { _visit_id: string }; Returns: boolean }
      request_consent_by_cpr: {
        Args: { _cpr: string; _duration: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "PATIENT" | "PRACTITIONER" | "ANALYST"
      care_team_status_enum: "ACTIVE" | "INACTIVE"
      code_system_enum: "SKS" | "ICD10" | "ICPC2" | "SNOMED" | "LOINC" | "ATC"
      consent_status_enum: "PENDING" | "ACTIVE" | "REVOKED" | "EXPIRED"
      disposition_enum: "HOME_CARE" | "PRESCRIPTION" | "ER_REFERRAL"
      employment_status_enum:
        | "EMPLOYED"
        | "SELF_EMPLOYED"
        | "UNEMPLOYED"
        | "STUDENT"
        | "RETIRED"
        | "UNABLE_TO_WORK"
        | "OTHER"
        | "UNKNOWN"
      encounter_type_enum: "NEW_ISSUE" | "FOLLOW_UP" | "CHRONIC_FLARE_UP"
      gender_identity_enum:
        | "MAN"
        | "WOMAN"
        | "NON_BINARY"
        | "TRANSGENDER_MAN"
        | "TRANSGENDER_WOMAN"
        | "OTHER"
        | "PREFER_NOT_TO_SAY"
      insurance_type_enum:
        | "PUBLIC_GROUP_1"
        | "PUBLIC_GROUP_2"
        | "PRIVATE"
        | "EU_EHIC"
        | "SELF_PAY"
        | "UNINSURED"
        | "UNKNOWN"
      marital_status_enum:
        | "SINGLE"
        | "MARRIED"
        | "PARTNERED"
        | "SEPARATED"
        | "DIVORCED"
        | "WIDOWED"
        | "UNKNOWN"
      organization_type_enum: "HOSPITAL" | "GP_CLINIC" | "SPECIALIST"
      practitioner_role_enum: "DOCTOR" | "NURSE" | "ADMIN"
      proxy_relationship_enum: "PARENT" | "GUARDIAN" | "SPOUSE" | "POA"
      proxy_status_enum: "ACTIVE" | "REVOKED"
      record_category_enum: "CONDITION" | "PROCEDURE" | "ALLERGY" | "REFERRAL"
      record_status_enum: "ACTIVE" | "RESOLVED" | "SUSPECTED"
      role_in_visit_enum: "REASON_FOR_VISIT" | "DIAGNOSED" | "FOLLOW_UP"
      sex_enum: "MALE" | "FEMALE" | "INTERSEX" | "UNKNOWN"
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
      care_team_status_enum: ["ACTIVE", "INACTIVE"],
      code_system_enum: ["SKS", "ICD10", "ICPC2", "SNOMED", "LOINC", "ATC"],
      consent_status_enum: ["PENDING", "ACTIVE", "REVOKED", "EXPIRED"],
      disposition_enum: ["HOME_CARE", "PRESCRIPTION", "ER_REFERRAL"],
      employment_status_enum: [
        "EMPLOYED",
        "SELF_EMPLOYED",
        "UNEMPLOYED",
        "STUDENT",
        "RETIRED",
        "UNABLE_TO_WORK",
        "OTHER",
        "UNKNOWN",
      ],
      encounter_type_enum: ["NEW_ISSUE", "FOLLOW_UP", "CHRONIC_FLARE_UP"],
      gender_identity_enum: [
        "MAN",
        "WOMAN",
        "NON_BINARY",
        "TRANSGENDER_MAN",
        "TRANSGENDER_WOMAN",
        "OTHER",
        "PREFER_NOT_TO_SAY",
      ],
      insurance_type_enum: [
        "PUBLIC_GROUP_1",
        "PUBLIC_GROUP_2",
        "PRIVATE",
        "EU_EHIC",
        "SELF_PAY",
        "UNINSURED",
        "UNKNOWN",
      ],
      marital_status_enum: [
        "SINGLE",
        "MARRIED",
        "PARTNERED",
        "SEPARATED",
        "DIVORCED",
        "WIDOWED",
        "UNKNOWN",
      ],
      organization_type_enum: ["HOSPITAL", "GP_CLINIC", "SPECIALIST"],
      practitioner_role_enum: ["DOCTOR", "NURSE", "ADMIN"],
      proxy_relationship_enum: ["PARENT", "GUARDIAN", "SPOUSE", "POA"],
      proxy_status_enum: ["ACTIVE", "REVOKED"],
      record_category_enum: ["CONDITION", "PROCEDURE", "ALLERGY", "REFERRAL"],
      record_status_enum: ["ACTIVE", "RESOLVED", "SUSPECTED"],
      role_in_visit_enum: ["REASON_FOR_VISIT", "DIAGNOSED", "FOLLOW_UP"],
      sex_enum: ["MALE", "FEMALE", "INTERSEX", "UNKNOWN"],
      urgency_enum: ["LOW", "MEDIUM", "HIGH_RED_FLAG"],
      visit_status_enum: ["SCHEDULED", "IN_PROGRESS", "COMPLETED"],
    },
  },
} as const
