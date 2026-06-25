/**
 * ============================================================
 * MODELOS / INTERFACES DE DATOS — Sprint 1
 * ============================================================
 *
 * Este archivo define las interfaces de TypeScript que representan
 * la estructura de los datos tal como se almacenan en la base de datos.
 *
 * Cada interfaz corresponde a una tabla en PostgreSQL (Railway):
 *
 * 📌 User        → tabla public.users
 * 📌 Family      → tabla public.families
 * 📌 Profile     → tabla public.profiles
 * 📌 QrToken     → tabla public.qr_tokens
 * 📌 ShowerLog   → tabla public.shower_logs  (nueva, crear con el SQL del walkthrough)
 * 📌 OnboardingAnswers → Datos del formulario de onboarding (se guardan como JSONB en profiles)
 *
 * 💡 PARA EL FRONTEND:
 *   Estos son exactamente los objetos JSON que recibirás en las respuestas de la API.
 *   Úsalos como referencia para modelar tus clases/tipos en Flutter o cualquier otro cliente.
 */

/**
 * Tabla: public.users
 * Propósito: Almacena las credenciales de acceso del usuario.
 * Solo el backend accede a esta tabla directamente.
 * El frontend NUNCA recibe la contraseña ni el password_hash.
 */
export interface User {
  id: string;            // UUID — clave primaria, se usa como foreign key en profiles
  email: string;         // Email único del usuario
  password_hash: string; // Hash bcrypt de la contraseña (nunca se envía al frontend)
  created_at?: Date;     // Timestamp de creación automático
}

/**
 * Tabla: public.families
 * Propósito: Representa un "Hogar" familiar.
 * El Jefe de Familia crea uno al registrarse.
 * Los miembros se asocian a él a través de profiles.family_id
 */
export interface Family {
  id: string;           // UUID del hogar — es el family_id que recibirá el frontend
  nombre: string;       // Nombre del hogar (ej. "Familia López")
  family_code: string;  // Código único de 6 caracteres para unirse (ej. "AB12CD")
  meta_luz?: number;    // Meta mensual de consumo de luz (kWh)
  meta_agua?: number;   // Meta mensual de consumo de agua (m³)
  avatar_url?: string;  // URL de la foto/avatar del hogar
  created_at: Date;     // Fecha de creación — usada para validar el bloqueo de 60 días
}

/**
 * Tabla: public.profiles
 * Propósito: Perfil completo del usuario en la app.
 * Es la tabla más importante para el frontend: contiene nombre, rol, XP, monedas, etc.
 *
 * 💡 Columna family_id: vincula al usuario con su hogar familiar.
 *    Si es NULL, el usuario aún no pertenece a ningún hogar.
 *
 * 💡 Columna rol: determina los permisos del usuario.
 *    - 'Jefe'    → Administrador del hogar (puede aprobar retos, editar metas, etc.)
 *    - 'Miembro' → Integrante normal del hogar
 *    - 'Co-Admin'→ Administrador secundario
 *
 * 💡 Columna onboarding_answers: campo JSONB que almacena las respuestas
 *    del cuestionario inicial. Se añade dinámicamente via ALTER TABLE.
 */
export interface Profile {
  id: string;                     // UUID — mismo que users.id (son la misma persona)
  email: string;
  nombre: string;
  avatar_letra?: string;          // Inicial del nombre para avatar generado (ej. "C")
  avatar_color?: string;          // Color hex del avatar (ej. "#2e7d32")
  avatar_url?: string;            // URL de foto de perfil personalizada
  rol?: string;                   // 'Jefe' | 'Miembro' | 'Co-Admin'
  family_id?: string | null;      // UUID del hogar al que pertenece (null si no tiene hogar)
  xp?: number;                    // Puntos de experiencia acumulados
  nivel?: number;                 // Nivel del usuario (calculado en base a XP)
  monedas?: number;               // Monedas virtuales del usuario
  trivia_correct_count?: number;  // Respuestas correctas acumuladas en trivia
  trivia_last_updated?: string;   // Última actualización de trivia (fecha string)
  daily_bonus_claimed_at?: string;// Fecha del último bonus diario reclamado
  created_at?: Date;
}

/**
 * Tabla: public.qr_tokens
 * Propósito: Almacena tokens temporales de invitación al hogar.
 * Se generan con un TTL de 10 minutos y se marcan como "used" al ser canjeados.
 * Si el token está expirado o ya fue usado, la API responde 410 Gone.
 *
 * 💡 El frontend/móvil genera un QR con el valor del campo "token" (UUID).
 *    El que escanea el QR lo envía a POST /familia/join con ese token.
 */
export interface QrToken {
  id: string;          // UUID del registro del token
  family_id: string;   // UUID del hogar al que da acceso
  token: string;       // UUID del token (este es el que viaja en el QR)
  used: boolean;       // true si ya fue canjeado
  expires_at: Date;    // Fecha de expiración (10 minutos desde la creación)
  created_at?: Date;
}

/**
 * Tabla: public.shower_logs
 * Propósito: Registra cada ducha cronometrada por un usuario.
 * El estado 'invalido' se aplica si la duración es menor a 180 segundos (3 minutos).
 * Esto previene que los usuarios hagan trampa registrando duchas falsas.
 *
 * ⚠️  IMPORTANTE: Esta tabla debe crearse manualmente en Railway.
 *    Ver el SQL en el archivo walkthrough.md
 */
export interface ShowerLog {
  id: string;                      // UUID del registro
  user_id: string;                 // UUID del usuario que se duchó
  duracion_segundos: number;       // Duración en segundos
  estado: 'valido' | 'invalido';  // 'invalido' si duracion_segundos < 180
  created_at?: Date;
}

/**
 * Formulario de Onboarding (no es una tabla separada)
 * Propósito: Estructura esperada en el body de POST /onboarding.
 * Las respuestas se guardan en profiles.onboarding_answers (campo JSONB).
 *
 * 💡 El formulario es diferente según el ROL del usuario autenticado:
 *
 * Para Jefe de Familia (rol: 'admin'):
 *   → personasCount, habitacionesCount, tipoCalefaccion, electrodomesticos
 *   → Se calculan metas de consumo para TODO el hogar
 *
 * Para Miembros (rol: 'miembro'):
 *   → tiempoDuchaPromedio, horasPantallaDiarias, frecuenciaReciclaje
 *   → Se calculan hábitos personales de consumo
 */
export interface OnboardingAnswers {
  // ── Preguntas para el Jefe de Familia (Infraestructura del hogar) ──
  tipoCalefaccion?: string;     // 'electrica' | 'gas' | 'lena' | 'otra'
  electrodomesticos?: string[]; // ['lavadora', 'secadora', 'lavavajillas', 'aire_acondicionado']
  habitacionesCount?: number;   // Número de habitaciones del hogar
  personasCount?: number;       // Número de personas que viven en el hogar

  // ── Preguntas para Miembros (Hábitos personales) ──
  tiempoDuchaPromedio?: number;   // Duración promedio de ducha en MINUTOS
  horasPantallaDiarias?: number;  // Horas de uso de pantallas por día
  frecuenciaReciclaje?: string;   // 'nunca' | 'ocasional' | 'siempre'
}
