import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Epic = {
  id: string
  title: string
  link: string | null
  r: number
  t: number
  q: number
  s: number
  status: 'prioritized' | 'unprioritized' | 'proposed'
  is_confirmed: boolean
  created_at: string
  updated_at: string
}

export type EpicWithPriority = {
  id: string
  title: string
  link: string | null
  r: number
  t: number
  q: number
  s: number
  status: 'prioritized' | 'unprioritized' | 'proposed'
  value: number
  total_sprint_points: number
  priority: number
  gate_count: number
  is_confirmed: boolean
  created_at: string
  updated_at: string
}

export type Story = {
  id: string
  epic_id: string
  title: string
  link: string | null
  sprint_points: number
  gate: boolean
  order_index: number
  status: 'official' | 'proposed'
  created_at: string
  updated_at: string
}

export type Metric = {
  id: string
  name: string
  coefficient: number
  sort_order: number
  is_active: boolean
  created_at: string
}

