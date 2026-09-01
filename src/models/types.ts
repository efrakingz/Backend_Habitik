/**
 * ============================================================
 * MODELOS / INTERFACES DE DATOS — Habitik
 * ============================================================
 */

export interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at?: Date;
}

export interface Family {
  id: string;
  nombre: string;
  family_code: string;
  meta_luz?: number;
  meta_agua?: number;
  avatar?: {
    url?: string | null;
    color?: string;
    emoji?: string;
  };
  created_at: Date;
}

export interface Profile {
  id: string;
  email: string;
  nombre: string;
  avatar?: {
    letra?: string;
    color?: string;
    url?: string | null;
  };
  rol?: string;
  family_id?: string | null;
  xp?: number;
  nivel?: number;
  monedas?: number;
  trivia_correct_count?: number;
  trivia_last_updated?: string;
  daily_bonus_claimed_at?: string;
  onboarding_answers?: Record<string, unknown>;
  ultima_actividad?: Date | null;
  racha_dias?: number;
  created_at?: Date;
}

export interface QrToken {
  id: string;
  family_id: string;
  token: string;
  used: boolean;
  expires_at: Date;
  created_at?: Date;
}

export interface ShowerLog {
  id: string;
  user_id: string;
  family_id?: string | null;
  duracion_segundos: number;
  estado: 'valido' | 'invalido';
  metadata?: Record<string, unknown>;
  xp_otorgada?: number;
  monedas_otorgadas?: number;
  es_valido?: boolean;
  created_at?: Date;
}

export interface OnboardingAnswers {
  tipoCalefaccion?: string;
  electrodomesticos?: string[];
  habitacionesCount?: number;
  personasCount?: number;
  tiempoDuchaPromedio?: number;
  horasPantallaDiarias?: number;
  frecuenciaReciclaje?: string;
}

/**
 * Tabla: public.notifications
 * Propósito: Almacena eventos, alertas y notificaciones del hogar familiar
 */
export interface AppNotification {
  id: string;
  family_id?: string | null;
  user_id?: string | null;
  sender_id?: string | null;
  sender_name?: string | null;
  title: string;
  desc_text: string;
  type?: string;
  visual?: {
    icon?: string;
    color?: string;
  };
  payload?: Record<string, any>;
  is_read?: boolean;
  created_at?: Date;
}

export interface FamilyReward {
  id: number;
  family_id: string;
  titulo: string;
  descripcion?: string | null;
  emoji?: string;
  costo: number;
  disponible: boolean;
  es_familiar: boolean;
  creador_id?: string | null;
  metadata?: Record<string, unknown>;
  last_redeemed_at?: Date | null;
  created_at: Date;
}

export interface FamilyRewardRedemption {
  id: string;
  reward_id: number;
  user_id: string;
  family_id: string;
  costo_pagado: number;
  created_at: Date;
}

export interface CreateFamilyRewardInput {
  titulo: string;
  descripcion?: string;
  emoji?: string;
  costo?: number;
  es_familiar?: boolean;
  metadata?: Record<string, unknown>;
}
