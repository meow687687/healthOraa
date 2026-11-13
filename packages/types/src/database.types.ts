
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "app_banners": {
                  Row: {
                    "created_at": string,"display_order": number,"id": string,"image_url": string,"is_active": boolean,"target_id": string | null,"target_type": Database["public"]['Enums']["banner_target_type"],"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_order"?: number,"id"?: string,"image_url": string,"is_active"?: boolean,"target_id"?: string | null,"target_type": Database["public"]['Enums']["banner_target_type"],"title": string
                  }
                  Update: {
                    "created_at"?: string,"display_order"?: number,"id"?: string,"image_url"?: string,"is_active"?: boolean,"target_id"?: string | null,"target_type"?: Database["public"]['Enums']["banner_target_type"],"title"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cart_items": {
                  Row: {
                    "created_at": string,"id": string,"patient_id": string,"product_id": string,"quantity": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"patient_id": string,"product_id": string,"quantity": number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"patient_id"?: string,"product_id"?: string,"quantity"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "cart_items_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cart_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"compliance_requests": {
                  Row: {
                    "created_at": string,"id": string,"notes": string | null,"request_type": Database["public"]['Enums']["compliance_request_type"],"resolved_at": string | null,"status": Database["public"]['Enums']["compliance_request_status"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"notes"?: string | null,"request_type": Database["public"]['Enums']["compliance_request_type"],"resolved_at"?: string | null,"status"?: Database["public"]['Enums']["compliance_request_status"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"notes"?: string | null,"request_type"?: Database["public"]['Enums']["compliance_request_type"],"resolved_at"?: string | null,"status"?: Database["public"]['Enums']["compliance_request_status"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "compliance_requests_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"consultation_messages": {
                  Row: {
                    "attachment_url": string | null,"consultation_id": string,"content": string | null,"created_at": string,"id": string,"sender_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attachment_url"?: string | null,"consultation_id": string,"content"?: string | null,"created_at"?: string,"id"?: string,"sender_id": string
                  }
                  Update: {
                    "attachment_url"?: string | null,"consultation_id"?: string,"content"?: string | null,"created_at"?: string,"id"?: string,"sender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "consultation_messages_consultation_id_fkey"
      columns: ["consultation_id"]
isOneToOne: false
      referencedRelation: "consultations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "consultation_messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"consultation_slots": {
                  Row: {
                    "consultation_id": string | null,"created_at": string,"end_time": string,"id": string,"is_booked": boolean,"practitioner_id": string,"start_time": string
                  }
                  ComputedFields: never
                  Insert: {
                    "consultation_id"?: string | null,"created_at"?: string,"end_time": string,"id"?: string,"is_booked"?: boolean,"practitioner_id": string,"start_time": string
                  }
                  Update: {
                    "consultation_id"?: string | null,"created_at"?: string,"end_time"?: string,"id"?: string,"is_booked"?: boolean,"practitioner_id"?: string,"start_time"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "consultation_slots_consultation_id_fkey"
      columns: ["consultation_id"]
isOneToOne: false
      referencedRelation: "consultations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "consultation_slots_practitioner_id_fkey"
      columns: ["practitioner_id"]
isOneToOne: false
      referencedRelation: "practitioner_details"
      referencedColumns: ["id"]
    }
                  ]
                },"consultations": {
                  Row: {
                    "amount_inr": number,"booking_status": Database["public"]['Enums']["booking_status"],"chief_complaint": string | null,"created_at": string,"doctor_id": string,"followup_expires_at": string | null,"id": string,"intake_id": string | null,"patient_id": string,"payment_order_id": string | null,"slot_end": string,"slot_id": string | null,"slot_start": string,"status": Database["public"]['Enums']["consultation_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_inr"?: number,"booking_status"?: Database["public"]['Enums']["booking_status"],"chief_complaint"?: string | null,"created_at"?: string,"doctor_id": string,"followup_expires_at"?: string | null,"id"?: string,"intake_id"?: string | null,"patient_id": string,"payment_order_id"?: string | null,"slot_end": string,"slot_id"?: string | null,"slot_start": string,"status"?: Database["public"]['Enums']["consultation_status"]
                  }
                  Update: {
                    "amount_inr"?: number,"booking_status"?: Database["public"]['Enums']["booking_status"],"chief_complaint"?: string | null,"created_at"?: string,"doctor_id"?: string,"followup_expires_at"?: string | null,"id"?: string,"intake_id"?: string | null,"patient_id"?: string,"payment_order_id"?: string | null,"slot_end"?: string,"slot_id"?: string | null,"slot_start"?: string,"status"?: Database["public"]['Enums']["consultation_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "consultations_doctor_id_fkey"
      columns: ["doctor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "consultations_intake_id_fkey"
      columns: ["intake_id"]
isOneToOne: false
      referencedRelation: "patient_intake_forms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "consultations_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "consultations_slot_id_fkey"
      columns: ["slot_id"]
isOneToOne: false
      referencedRelation: "consultation_slots"
      referencedColumns: ["id"]
    }
                  ]
                },"diagnostic_reports": {
                  Row: {
                    "consultation_id": string | null,"file_size_bytes": number | null,"file_type": string,"file_url": string,"id": string,"patient_id": string,"report_title": string,"uploaded_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "consultation_id"?: string | null,"file_size_bytes"?: number | null,"file_type": string,"file_url": string,"id"?: string,"patient_id": string,"report_title": string,"uploaded_at"?: string
                  }
                  Update: {
                    "consultation_id"?: string | null,"file_size_bytes"?: number | null,"file_type"?: string,"file_url"?: string,"id"?: string,"patient_id"?: string,"report_title"?: string,"uploaded_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "diagnostic_reports_consultation_id_fkey"
      columns: ["consultation_id"]
isOneToOne: false
      referencedRelation: "consultations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "diagnostic_reports_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "created_at": string,"id": string,"order_id": string,"product_id": string,"quantity": number,"unit_price_inr": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"order_id": string,"product_id": string,"quantity": number,"unit_price_inr": number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"order_id"?: string,"product_id"?: string,"quantity"?: number,"unit_price_inr"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "created_at": string,"customer_id": string,"id": string,"shipping_address": string,"status": Database["public"]['Enums']["order_status"],"total_amount_inr": number,"tracking_number": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"customer_id": string,"id"?: string,"shipping_address": string,"status"?: Database["public"]['Enums']["order_status"],"total_amount_inr": number,"tracking_number"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"customer_id"?: string,"id"?: string,"shipping_address"?: string,"status"?: Database["public"]['Enums']["order_status"],"total_amount_inr"?: number,"tracking_number"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"patient_biomarkers": {
                  Row: {
                    "created_at": string,"document_id": string | null,"id": string,"marker_name": string,"marker_value": number,"patient_id": string,"reference_range": string | null,"tested_at": string,"unit": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"document_id"?: string | null,"id"?: string,"marker_name": string,"marker_value": number,"patient_id": string,"reference_range"?: string | null,"tested_at": string,"unit": string
                  }
                  Update: {
                    "created_at"?: string,"document_id"?: string | null,"id"?: string,"marker_name"?: string,"marker_value"?: number,"patient_id"?: string,"reference_range"?: string | null,"tested_at"?: string,"unit"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "patient_biomarkers_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "patient_documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_biomarkers_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"patient_documents": {
                  Row: {
                    "category": Database["public"]['Enums']["diagnostic_category"],"created_at": string,"document_date": string,"extracted_metadata": Json | null,"file_path": string,"file_size_bytes": number | null,"id": string,"is_verified": boolean,"mime_type": string,"patient_id": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: Database["public"]['Enums']["diagnostic_category"],"created_at"?: string,"document_date"?: string,"extracted_metadata"?: Json | null,"file_path": string,"file_size_bytes"?: number | null,"id"?: string,"is_verified"?: boolean,"mime_type"?: string,"patient_id": string,"title": string
                  }
                  Update: {
                    "category"?: Database["public"]['Enums']["diagnostic_category"],"created_at"?: string,"document_date"?: string,"extracted_metadata"?: Json | null,"file_path"?: string,"file_size_bytes"?: number | null,"id"?: string,"is_verified"?: boolean,"mime_type"?: string,"patient_id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "patient_documents_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"patient_intake_forms": {
                  Row: {
                    "age": number,"chief_complaint": string,"consultation_id": string | null,"created_at": string,"current_medications": (string)[] | null,"gender": string,"id": string,"known_allergies": (string)[] | null,"medical_history": (string)[] | null,"patient_id": string,"symptoms_duration": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "age": number,"chief_complaint": string,"consultation_id"?: string | null,"created_at"?: string,"current_medications"?: (string)[] | null,"gender": string,"id"?: string,"known_allergies"?: (string)[] | null,"medical_history"?: (string)[] | null,"patient_id": string,"symptoms_duration"?: string | null
                  }
                  Update: {
                    "age"?: number,"chief_complaint"?: string,"consultation_id"?: string | null,"created_at"?: string,"current_medications"?: (string)[] | null,"gender"?: string,"id"?: string,"known_allergies"?: (string)[] | null,"medical_history"?: (string)[] | null,"patient_id"?: string,"symptoms_duration"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "patient_intake_forms_consultation_id_fkey"
      columns: ["consultation_id"]
isOneToOne: false
      referencedRelation: "consultations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_intake_forms_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_transactions": {
                  Row: {
                    "amount_inr": number,"consultation_id": string | null,"created_at": string,"currency": string,"error_code": string | null,"error_description": string | null,"gateway": Database["public"]['Enums']["payment_gateway"],"gateway_order_id": string | null,"gateway_payment_id": string | null,"id": string,"order_id": string | null,"status": Database["public"]['Enums']["payment_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_inr": number,"consultation_id"?: string | null,"created_at"?: string,"currency"?: string,"error_code"?: string | null,"error_description"?: string | null,"gateway"?: Database["public"]['Enums']["payment_gateway"],"gateway_order_id"?: string | null,"gateway_payment_id"?: string | null,"id"?: string,"order_id"?: string | null,"status"?: Database["public"]['Enums']["payment_status"]
                  }
                  Update: {
                    "amount_inr"?: number,"consultation_id"?: string | null,"created_at"?: string,"currency"?: string,"error_code"?: string | null,"error_description"?: string | null,"gateway"?: Database["public"]['Enums']["payment_gateway"],"gateway_order_id"?: string | null,"gateway_payment_id"?: string | null,"id"?: string,"order_id"?: string | null,"status"?: Database["public"]['Enums']["payment_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_transactions_consultation_id_fkey"
      columns: ["consultation_id"]
isOneToOne: false
      referencedRelation: "consultations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_transactions_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"practitioner_availability_rules": {
                  Row: {
                    "created_at": string,"day_of_week": number,"end_time": string,"id": string,"is_active": boolean,"practitioner_id": string,"start_time": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"day_of_week": number,"end_time": string,"id"?: string,"is_active"?: boolean,"practitioner_id": string,"start_time": string
                  }
                  Update: {
                    "created_at"?: string,"day_of_week"?: number,"end_time"?: string,"id"?: string,"is_active"?: boolean,"practitioner_id"?: string,"start_time"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "practitioner_availability_rules_practitioner_id_fkey"
      columns: ["practitioner_id"]
isOneToOne: false
      referencedRelation: "practitioner_details"
      referencedColumns: ["id"]
    }
                  ]
                },"practitioner_details": {
                  Row: {
                    "avatar_url": string | null,"bio": string | null,"consultation_fee_inr": number,"created_at": string,"documents_url": string | null,"id": string,"is_active": boolean,"languages_spoken": (string)[] | null,"qualification": string,"registration_number": string,"rejection_reason": string | null,"signature_image_url": string | null,"slot_duration_minutes": number,"updated_at": string | null,"verification_status": Database["public"]['Enums']["verification_status"],"years_of_experience": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"bio"?: string | null,"consultation_fee_inr"?: number,"created_at"?: string,"documents_url"?: string | null,"id": string,"is_active"?: boolean,"languages_spoken"?: (string)[] | null,"qualification": string,"registration_number": string,"rejection_reason"?: string | null,"signature_image_url"?: string | null,"slot_duration_minutes"?: number,"updated_at"?: string | null,"verification_status"?: Database["public"]['Enums']["verification_status"],"years_of_experience"?: number | null
                  }
                  Update: {
                    "avatar_url"?: string | null,"bio"?: string | null,"consultation_fee_inr"?: number,"created_at"?: string,"documents_url"?: string | null,"id"?: string,"is_active"?: boolean,"languages_spoken"?: (string)[] | null,"qualification"?: string,"registration_number"?: string,"rejection_reason"?: string | null,"signature_image_url"?: string | null,"slot_duration_minutes"?: number,"updated_at"?: string | null,"verification_status"?: Database["public"]['Enums']["verification_status"],"years_of_experience"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "practitioner_details_id_fkey"
      columns: ["id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"prescription_medicines": {
                  Row: {
                    "created_at": string,"dosage": string,"duration_days": number,"frequency": string,"id": string,"instructions": string | null,"name": string,"prescription_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"dosage": string,"duration_days"?: number,"frequency": string,"id"?: string,"instructions"?: string | null,"name": string,"prescription_id": string
                  }
                  Update: {
                    "created_at"?: string,"dosage"?: string,"duration_days"?: number,"frequency"?: string,"id"?: string,"instructions"?: string | null,"name"?: string,"prescription_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "prescription_medicines_prescription_id_fkey"
      columns: ["prescription_id"]
isOneToOne: false
      referencedRelation: "prescriptions"
      referencedColumns: ["id"]
    }
                  ]
                },"prescriptions": {
                  Row: {
                    "clinical_notes": string | null,"consultation_id": string,"created_at": string,"diagnosis": string,"doctor_id": string,"followup_days": number,"id": string,"patient_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "clinical_notes"?: string | null,"consultation_id": string,"created_at"?: string,"diagnosis": string,"doctor_id": string,"followup_days"?: number,"id"?: string,"patient_id": string
                  }
                  Update: {
                    "clinical_notes"?: string | null,"consultation_id"?: string,"created_at"?: string,"diagnosis"?: string,"doctor_id"?: string,"followup_days"?: number,"id"?: string,"patient_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "prescriptions_consultation_id_fkey"
      columns: ["consultation_id"]
isOneToOne: false
      referencedRelation: "consultations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "prescriptions_doctor_id_fkey"
      columns: ["doctor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "prescriptions_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "category": Database["public"]['Enums']["product_category"],"created_at": string,"description": string | null,"id": string,"is_active": boolean,"price_inr": number,"sku": string,"stock_count": number,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": Database["public"]['Enums']["product_category"],"created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"price_inr": number,"sku": string,"stock_count"?: number,"title": string
                  }
                  Update: {
                    "category"?: Database["public"]['Enums']["product_category"],"created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"price_inr"?: number,"sku"?: string,"stock_count"?: number,"title"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"full_name": string,"id": string,"phone": string | null,"role": Database["public"]['Enums']["user_role"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"full_name": string,"id": string,"phone"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"full_name"?: string,"id"?: string,"phone"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"program_enrolments": {
                  Row: {
                    "created_at": string,"dietitian_id": string | null,"expires_at": string,"id": string,"patient_id": string,"program_id": string,"started_at": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"dietitian_id"?: string | null,"expires_at": string,"id"?: string,"patient_id": string,"program_id": string,"started_at"?: string,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"dietitian_id"?: string | null,"expires_at"?: string,"id"?: string,"patient_id"?: string,"program_id"?: string,"started_at"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "program_enrolments_dietitian_id_fkey"
      columns: ["dietitian_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "program_enrolments_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "program_enrolments_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    }
                  ]
                },"program_messages": {
                  Row: {
                    "attachment_url": string | null,"content": string | null,"created_at": string,"enrolment_id": string,"id": string,"is_meal_photo": boolean,"sender_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attachment_url"?: string | null,"content"?: string | null,"created_at"?: string,"enrolment_id": string,"id"?: string,"is_meal_photo"?: boolean,"sender_id": string
                  }
                  Update: {
                    "attachment_url"?: string | null,"content"?: string | null,"created_at"?: string,"enrolment_id"?: string,"id"?: string,"is_meal_photo"?: boolean,"sender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "program_messages_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: false
      referencedRelation: "program_enrolments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "program_messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"program_progress_logs": {
                  Row: {
                    "day_number": number,"dietitian_feedback": string | null,"enrolment_id": string,"id": string,"logged_at": string,"meals_logged": Json | null,"water_intake_ml": number | null,"weight_kg": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "day_number": number,"dietitian_feedback"?: string | null,"enrolment_id": string,"id"?: string,"logged_at"?: string,"meals_logged"?: Json | null,"water_intake_ml"?: number | null,"weight_kg"?: number | null
                  }
                  Update: {
                    "day_number"?: number,"dietitian_feedback"?: string | null,"enrolment_id"?: string,"id"?: string,"logged_at"?: string,"meals_logged"?: Json | null,"water_intake_ml"?: number | null,"weight_kg"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "program_progress_logs_enrolment_id_fkey"
      columns: ["enrolment_id"]
isOneToOne: false
      referencedRelation: "program_enrolments"
      referencedColumns: ["id"]
    }
                  ]
                },"programs": {
                  Row: {
                    "category": Database["public"]['Enums']["program_category"],"created_at": string,"description": string | null,"duration_days": number,"id": string,"is_active": boolean,"price_inr": number,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": Database["public"]['Enums']["program_category"],"created_at"?: string,"description"?: string | null,"duration_days"?: number,"id"?: string,"is_active"?: boolean,"price_inr": number,"title": string
                  }
                  Update: {
                    "category"?: Database["public"]['Enums']["program_category"],"created_at"?: string,"description"?: string | null,"duration_days"?: number,"id"?: string,"is_active"?: boolean,"price_inr"?: number,"title"?: string
                  }
                  Relationships: [
                    
                  ]
                },"razorpay_order_logs": {
                  Row: {
                    "amount_paise": number,"created_at": string,"currency": string,"entity_id": string,"entity_type": string,"id": string,"order_id": string,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_paise": number,"created_at"?: string,"currency"?: string,"entity_id": string,"entity_type": string,"id"?: string,"order_id": string,"status"?: string,"user_id": string
                  }
                  Update: {
                    "amount_paise"?: number,"created_at"?: string,"currency"?: string,"entity_id"?: string,"entity_type"?: string,"id"?: string,"order_id"?: string,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "razorpay_order_logs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "book_consultation_slot":
{ Args: { "p_chief_complaint": string,"p_patient_id": string,"p_slot_id": string }; Returns: {
              "amount_inr": number,
"booking_status": Database["public"]['Enums']["booking_status"],
"chief_complaint": string | null,
"created_at": string,
"doctor_id": string,
"followup_expires_at": string | null,
"id": string,
"intake_id": string | null,
"patient_id": string,
"payment_order_id": string | null,
"slot_end": string,
"slot_id": string | null,
"slot_start": string,
"status": Database["public"]['Enums']["consultation_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "consultations"
        isOneToOne: true
        isSetofReturn: false
      } },
"current_user_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["user_role"]
                           },
"generate_consultation_slots":
{ Args: { "p_date": string,"p_practitioner_id": string }; Returns: number
                           },
"get_patient_biomarkers":
{ Args: { "p_marker_name"?: string,"p_patient_id": string }; Returns: {
              "created_at": string,
"document_id": string | null,
"id": string,
"marker_name": string,
"marker_value": number,
"patient_id": string,
"reference_range": string | null,
"tested_at": string,
"unit": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "patient_biomarkers"
        isOneToOne: false
        isSetofReturn: true
      } },
"get_patient_documents":
{ Args: { "p_patient_id": string }; Returns: {
              "category": Database["public"]['Enums']["diagnostic_category"],
"created_at": string,
"document_date": string,
"extracted_metadata": Json | null,
"file_path": string,
"file_size_bytes": number | null,
"id": string,
"is_verified": boolean,
"mime_type": string,
"patient_id": string,
"title": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "patient_documents"
        isOneToOne: false
        isSetofReturn: true
      } },
"initiate_consultation_booking":
{ Args: { "p_chief_complaint": string,"p_patient_id": string,"p_slot_id": string }; Returns: {
              "consultation_row": Database["public"]['Tables']["consultations"]['Row'],"order_id": string,"total_paise": number
            }[]
                           },
"issue_prescription":
{ Args: { "p_clinical_notes": string,"p_consultation_id": string,"p_diagnosis": string,"p_followup_days": number,"p_medicines": Json }; Returns: string
                           },
"place_shop_order":
{ Args: { "p_patient_id": string,"p_shipping_address": string }; Returns: {
              "created_at": string,
"customer_id": string,
"id": string,
"shipping_address": string,
"status": Database["public"]['Enums']["order_status"],
"total_amount_inr": number,
"tracking_number": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "orders"
        isOneToOne: true
        isSetofReturn: false
      } },
"publish_schedule":
{ Args: { "p_days"?: number,"p_duration_minutes": number,"p_rules": Json }; Returns: number
                           },
"resolve_erasure_request":
{ Args: { "p_request_id": string }; Returns: {
              "created_at": string,
"id": string,
"notes": string | null,
"request_type": Database["public"]['Enums']["compliance_request_type"],
"resolved_at": string | null,
"status": Database["public"]['Enums']["compliance_request_status"],
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "compliance_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"update_practitioner_profile":
{ Args: { "p_bio": string,"p_consultation_fee_inr": number,"p_languages": (string)[],"p_qualification": string,"p_slot_duration_minutes": number,"p_years_of_experience": number }; Returns: {
              "avatar_url": string | null,
"bio": string | null,
"consultation_fee_inr": number,
"created_at": string,
"documents_url": string | null,
"id": string,
"is_active": boolean,
"languages_spoken": (string)[] | null,
"qualification": string,
"registration_number": string,
"rejection_reason": string | null,
"signature_image_url": string | null,
"slot_duration_minutes": number,
"updated_at": string | null,
"verification_status": Database["public"]['Enums']["verification_status"],
"years_of_experience": number | null
            }
                          SetofOptions: {
        from: "*"
        to: "practitioner_details"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "banner_target_type": "program"|"doctor"|"shop_product"|"external_url","booking_status": "pending_payment"|"confirmed"|"cancelled"|"rescheduled","compliance_request_status": "pending"|"processing"|"completed"|"rejected","compliance_request_type": "data_export"|"erasure_request"|"consent_withdrawal","consultation_status": "scheduled"|"in_progress"|"completed"|"cancelled","diagnostic_category": "blood_panel"|"imaging_radiology"|"prescription"|"discharge_summary"|"other","order_status": "pending"|"paid"|"shipped"|"delivered"|"cancelled","payment_gateway": "razorpay"|"upi_direct","payment_status": "initiated"|"captured"|"failed"|"refunded","product_category": "supplements"|"ayurvedic"|"skincare"|"equipment","program_category": "weight_management"|"pcod_pcos"|"dermato_nutrition"|"custom","user_role": "patient"|"practitioner"|"admin","verification_status": "pending"|"verified"|"rejected"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "banner_target_type": ["program", "doctor", "shop_product", "external_url"],"booking_status": ["pending_payment", "confirmed", "cancelled", "rescheduled"],"compliance_request_status": ["pending", "processing", "completed", "rejected"],"compliance_request_type": ["data_export", "erasure_request", "consent_withdrawal"],"consultation_status": ["scheduled", "in_progress", "completed", "cancelled"],"diagnostic_category": ["blood_panel", "imaging_radiology", "prescription", "discharge_summary", "other"],"order_status": ["pending", "paid", "shipped", "delivered", "cancelled"],"payment_gateway": ["razorpay", "upi_direct"],"payment_status": ["initiated", "captured", "failed", "refunded"],"product_category": ["supplements", "ayurvedic", "skincare", "equipment"],"program_category": ["weight_management", "pcod_pcos", "dermato_nutrition", "custom"],"user_role": ["patient", "practitioner", "admin"],"verification_status": ["pending", "verified", "rejected"]
          }
        }
} as const
