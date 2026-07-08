// Basic types for CarCore

export type UserRole = 'admin' | 'reception'

export interface Tenant {
  id: string
  name: string
  slug: string
  logo_url?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  created_at: string
}

export interface Profile {
  id: string
  tenant_id: string
  full_name: string
  role: UserRole
  email: string
  created_at: string
}

export interface Client {
  id: string
  tenant_id: string
  name: string
  phone: string
  email?: string | null
  created_at: string
}

export interface Vehicle {
  id: string
  tenant_id: string
  client_id: string
  make: string
  model: string
  year?: number | null
  vin?: string | null              // serie caroserie
  license_plate?: string | null
  mileage?: number | null
  created_at: string
}

export interface Intervention {
  id: string
  tenant_id: string
  vehicle_id: string
  description: string
  performed_at: string
  photos: string[]                 // array of storage paths (4-6 photos)
  created_at: string
}

export interface Service {
  id: string
  tenant_id: string
  name: string
  price: number
  duration_minutes?: number | null
  created_at: string
}

export interface Appointment {
  id: string
  tenant_id: string
  client_id: string
  vehicle_id: string
  scheduled_at: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  notes?: string | null
  created_at: string
}

export interface Invoice {
  id: string
  tenant_id: string
  client_id: string
  appointment_id?: string | null
  number: string
  issued_at: string
  total: number
  pdf_url?: string | null
  status: 'draft' | 'sent' | 'paid' | 'cancelled'
  created_at: string
}

export interface Part {
  id: string
  tenant_id: string
  intervention_id?: string | null
  vehicle_id?: string | null
  name: string
  distributor?: string | null
  quantity: number
  purchase_price: number
  selling_price: number
  notes?: string | null
  created_at: string
}

export interface PartInventory {
  id: string
  tenant_id: string
  name: string
  distributor?: string | null
  current_stock: number
  last_purchase_price?: number | null
  created_at: string
  updated_at: string
}
