import { Request, Response } from 'express';
import { OnboardingService } from '../services/onboardingService';
import { OnboardingAnswers } from '../models/types';

const onboardingService = new OnboardingService();

/**
 * ============================================================
 * CONTROLADOR DE ONBOARDING — /onboarding
 * ============================================================
 *
 * Procesa el cuestionario inicial que el usuario completa al entrar por primera vez.
 * El cuestionario es DIFERENTE según el ROL del usuario autenticado:
 *
 *   🏠 Jefe de Familia (rol: 'admin'):
 *      Responde preguntas sobre la INFRAESTRUCTURA del hogar.
 *      El resultado estima el consumo de todo el hogar.
 *
 *   👤 Miembro (rol: 'miembro'):
 *      Responde preguntas sobre sus HÁBITOS PERSONALES.
 *      El resultado estima su contribución individual al consumo.
 *
 * 📦 DATOS GUARDADOS EN LA BD:
 *   public.profiles.onboarding_answers (JSONB) → respuestas guardadas
 *   Nota: si la columna no existe, se crea automáticamente con ALTER TABLE.
 *
 * 📤 RETORNA: Un "Mapa de Gasto Estimado" con baseline de consumo de luz y agua.
 */

/**
 * POST /onboarding
 *
 * ✅ Procesa las respuestas del cuestionario y calcula el baseline de consumo.
 *
 * 🔐 REQUIERE: JWT válido (cualquier usuario autenticado)
 *    El rol del usuario se lee automáticamente desde req.auth.role
 *
 * 📥 BODY PARA JEFE DE FAMILIA (rol: 'admin'):
 * {
 *   "personasCount":      4,                         // requerido para admin
 *   "habitacionesCount":  3,                         // requerido para admin
 *   "tipoCalefaccion":    "electrica",               // 'electrica'|'gas'|'lena'|'otra'
 *   "electrodomesticos":  ["lavadora", "secadora"]   // lista de electrodomésticos
 * }
 *
 * 📥 BODY PARA MIEMBRO (rol: 'miembro'):
 * {
 *   "tiempoDuchaPromedio":   8,          // requerido — minutos promedio de ducha
 *   "horasPantallaDiarias":  4,          // horas de uso de pantallas por día
 *   "frecuenciaReciclaje":   "ocasional" // 'nunca'|'ocasional'|'siempre'
 * }
 *
 * 📤 RESPUESTA EXITOSA 200:
 * {
 *   "message": "Onboarding completado exitosamente.",
 *   "mapa_gasto_estimado": {
 *     "baseline_luz_kwh":       230,        // Consumo estimado mensual en kWh
 *     "baseline_agua_m3":       14.0,       // Consumo estimado mensual en m³
 *     "costo_estimado_luz":     34500,      // Costo estimado en pesos (kWh × tarifa)
 *     "costo_estimado_agua":    16800,      // Costo estimado en pesos (m³ × tarifa)
 *     "gasto_total_estimado":   51300,      // Total estimado del mes
 *     "recomendaciones": [                  // Tips personalizados según respuestas
 *       "Tu calefacción eléctrica representa el mayor consumo..."
 *     ]
 *   }
 * }
 *
 * ❌ ERRORES:
 *   400 — Body vacío o campos requeridos ausentes según el rol
 *   401 — Token JWT inválido/expirado
 *   500 — Error interno
 */
export const submitOnboarding = async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth?.user_id;
  const role = req.auth?.role;

  if (!userId) {
    res.status(401).json({ message: 'No autenticado.' });
    return;
  }

  const answers: OnboardingAnswers = req.body;

  if (!answers || Object.keys(answers).length === 0) {
    res.status(400).json({
      message: 'Las respuestas del cuestionario son requeridas.',
      hint: role === 'admin'
        ? 'Para Jefes envía: personasCount, habitacionesCount, tipoCalefaccion, electrodomesticos'
        : 'Para Miembros envía: tiempoDuchaPromedio, horasPantallaDiarias, frecuenciaReciclaje'
    });
    return;
  }

  // Validación de campos requeridos según el rol
  if (role === 'admin') {
    if (!answers.personasCount || !answers.habitacionesCount) {
      res.status(400).json({
        message: 'Los campos personasCount y habitacionesCount son requeridos para el Jefe de Familia.'
      });
      return;
    }
  } else {
    if (answers.tiempoDuchaPromedio === undefined) {
      res.status(400).json({
        message: 'El campo tiempoDuchaPromedio (en minutos) es requerido para los miembros.'
      });
      return;
    }
  }

  try {
    const mapaGasto = await onboardingService.saveOnboardingAndCalculate(
      userId,
      role === 'admin' ? 'Jefe' : 'Miembro',
      answers
    );

    res.status(200).json({
      message: 'Onboarding completado exitosamente.',
      mapa_gasto_estimado: mapaGasto
    });
  } catch (error) {
    console.error('[onboardingController.submitOnboarding]', error);
    res.status(500).json({ message: 'Error interno al procesar el onboarding.' });
  }
};
