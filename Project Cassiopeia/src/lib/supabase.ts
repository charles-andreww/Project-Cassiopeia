import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables are missing. Memory features will not work.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

// Types for our memory system
export interface Memory {
  id: string;
  user_uuid: string;
  name: string;
  memory: string;
  created_at: string;
  updated_at: string;
}

export interface MemoryInsert {
  user_uuid: string;
  name: string;
  memory: string;
}

export interface MemoryUpdate {
  memory: string;
  updated_at?: string;
}