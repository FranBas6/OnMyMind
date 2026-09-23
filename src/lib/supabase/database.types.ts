// ⚠️ Archivo generado. No lo edites a mano.
// Se regenera desde el proyecto Supabase local con `pnpm supabase:types`
// (supabase gen types typescript --local). Mientras no haya migraciones, contiene
// solo el esqueleto vacío del esquema `public` para que el cliente quede tipado.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
