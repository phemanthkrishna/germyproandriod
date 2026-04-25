export type Role = 'customer' | 'worker' | 'admin'

export type OrderStatus =
  | 'booked'
  | 'worker_visiting'
  | 'inspecting'
  | 'quote_sent'
  | 'in_progress'
  | 'material_collected'
  | 'done_uploaded'
  | 'completed'
  | 'cancelled'

export interface Profile {
  id: string
  phone: string
  role: Role
  name: string
  session_token?: string
  saved_addresses?: Array<{ label: string; address: string; lat?: number; lng?: number }>
  created_at: string
}

export interface Worker {
  id: string
  name: string
  phone: string
  service: string
  aadhaar_url?: string
  aadhaar_front_url?: string
  aadhaar_back_url?: string
  photo_url?: string
  upi_id?: string
  address?: string
  city?: string
  experience_years?: number
  avg_rating?: number
  total_ratings?: number
  verified: boolean
  service_categories: string[]
  is_online: boolean
  is_active: boolean
  completed_milestones?: Array<{ job: number; earnedAt: string }>
  worker_code?: string
  created_at: string
}

export interface QuoteMaterial {
  name: string
  qty: number
  unit: string
  price?: number
}

export interface Order {
  id: string
  customer_id: string
  customer_name: string
  customer_phone: string
  service: string
  service_emoji: string
  address: string
  customer_lat?: number
  customer_lng?: number
  customer_city?: string
  problem_description?: string
  status: OrderStatus
  booking_amt: number
  booking_paid: boolean
  worker_id?: string
  worker_name?: string
  worker_phone?: string
  arrival_otp: string
  quote_labour?: number
  quote_materials: QuoteMaterial[]
  mat_cost_admin?: number
  total_quote?: number
  final_paid: boolean
  job_photo_url?: string
  comp_otp: string
  rating?: number
  upi_booking_ref?: string
  upi_final_ref?: string
  mat_payment_done: boolean
  mat_discount_pct: number
  mat_commission: number
  worker_cancellation_pay?: number
  cancellation_pay_settled?: boolean
  labour_pay_settled?: boolean
  mat_store_id?: string
  mat_store_name?: string
  mat_store_contact?: string
  mat_collection_otp?: string
  mat_collected?: boolean
  mat_cost_store?: number
  labour_approval_pending?: boolean
  labour_pending_amount?: number
  declined_worker_ids?: string[]
  preferred_worker_id?: string | null
  preferred_worker_code?: string | null
  mat_list_photo_url?: string
  // AC Service package flow
  ac_package_id?: string | null
  ac_package_name?: string | null
  ac_package_price?: number | null
  ac_remaining_paid?: boolean
  created_at: string
  updated_at: string
}

export interface AcServicePackage {
  id: string
  name: string
  description?: string
  price: number
  is_active: boolean
  sort_order: number
  discount_pct: number          // 0 = no discount; e.g. 20 = 20% off package price
  discount_start?: string | null
  discount_end?: string | null
  created_at: string
  updated_at: string
}

export type AdminRole = 'admin' | 'manager' | 'accountant'

export interface StoredSession {
  id: string
  name: string
  phone: string
  role: Role
  adminRole?: AdminRole  // only set when role === 'admin'
}

export interface BonusClaim {
  id: string
  worker_id: string
  worker_name: string
  milestone_job: number
  milestone_badge: string
  milestone_icon: string
  amount: number
  status: 'pending' | 'paid'
  created_at: string
  paid_at?: string
}

export interface PayoutLog {
  id: string
  order_id?: string   // TEXT (matches orders.id)
  payee_type: 'worker' | 'store' | 'bonus'
  payee_id?: string   // TEXT
  payee_name: string
  payee_upi?: string
  amount: number
  payment_ref?: string
  note?: string
  marked_by?: string
  paid_at: string
  created_at: string
}

export interface StoreOrder {
  id: string
  customer_name: string
  customer_phone: string
  service: string
  service_emoji: string
  address: string
  status: OrderStatus
  mat_store_id: string
  worker_name?: string
  worker_phone?: string
  quote_materials: QuoteMaterial[]
  mat_cost_admin?: number
  mat_cost_store?: number
  store_earnings?: number
  mat_collection_otp?: string
  mat_collected: boolean
  quote_labour?: number
  total_quote?: number
  mat_list_photo_url?: string
  created_at: string
}
