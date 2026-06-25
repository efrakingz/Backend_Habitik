import { query } from '../config/db';
import { OnboardingAnswers } from '../models/types';

export class OnboardingService {
  async saveOnboardingAndCalculate(userId: string, rol: string, answers: OnboardingAnswers) {
    // 1. Guardar las respuestas en la base de datos (columna onboarding_answers en public.profiles)
    // Añadiremos soporte para guardar esto en un campo JSONB. Ejecutamos un ALTER TABLE dinámico si no existe.
    try {
      await query('ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_answers JSONB');
    } catch (e) {
      // Ignorar si ya existe o falla por permisos menores
    }

    await query(
      'UPDATE public.profiles SET onboarding_answers = $1 WHERE id = $2',
      [JSON.stringify(answers), userId]
    );

    // 2. Calcular baseline según el rol
    let baselineLuz = 120; // base estándar kWh
    let baselineAgua = 5;  // base estándar m3
    const recomendaciones: string[] = [];

    if (rol === 'Jefe' || rol === 'admin') {
      // Cálculo de infraestructura (HU 1.3-1)
      const habitaciones = answers.habitacionesCount || 1;
      const personas = answers.personasCount || 1;
      const calefaccion = answers.tipoCalefaccion || 'otra';
      const electrodomesticos = answers.electrodomesticos || [];

      // Luz
      baselineLuz += habitaciones * 30;
      baselineLuz += personas * 20;

      if (calefaccion.toLowerCase() === 'electrica') {
        baselineLuz += 150;
        recomendaciones.push('Tu calefacción eléctrica representa el mayor consumo de tu hogar. Intenta regular la temperatura a 19°C.');
      } else if (calefaccion.toLowerCase() === 'gas') {
        baselineLuz += 20;
      }

      baselineLuz += electrodomesticos.length * 15;
      if (electrodomesticos.includes('secadora')) {
        recomendaciones.push('Las secadoras de ropa consumen mucha electricidad. Prioriza el secado al aire libre.');
      }

      // Agua
      baselineAgua = personas * 3.5; // 3.5 m3 por persona al mes promedio
      if (personas > 4) {
        recomendaciones.push('Al ser un hogar numeroso, instalar aireadores en los grifos puede ahorrar hasta un 40% de agua.');
      }

    } else {
      // Cálculo de hábitos personales del miembro (HU 1.3-2)
      const tiempoDucha = answers.tiempoDuchaPromedio || 8;
      const horasPantalla = answers.horasPantallaDiarias || 4;
      const reciclaje = answers.frecuenciaReciclaje || 'nunca';

      // Impacto estimado por miembro
      baselineLuz += horasPantalla * 0.05 * 30; // 0.05kWh por hora de pantalla
      if (horasPantalla > 6) {
        recomendaciones.push('Tu tiempo de pantalla diario es elevado. Desconecta tus dispositivos cuando no los uses para evitar consumo vampiro.');
      }

      // Agua: una ducha promedio de 1 min consume ~10 litros. 30 duchas al mes.
      const litrosAguaDuchaMes = tiempoDucha * 10 * 30;
      baselineAgua = parseFloat((litrosAguaDuchaMes / 1000).toFixed(1)); // Convertir a m3

      if (tiempoDucha > 5) {
        recomendaciones.push(`Tu ducha promedio dura ${tiempoDucha} minutos. Bajarla a 5 minutos ahorraría ${(tiempoDucha - 5) * 10 * 30} litros de agua al mes.`);
      }

      if (reciclaje === 'siempre') {
        baselineLuz -= 10; // Crédito verde
        recomendaciones.push('¡Excelente hábito de reciclaje! Esto reduce indirectamente la huella energética.');
      } else if (reciclaje === 'nunca') {
        recomendaciones.push('Comienza separando plásticos y cartones. El reciclaje ayuda a conservar recursos globales.');
      }
    }

    // Tarifas estimadas de servicios
    const costoKwh = 150; // CLP o moneda local por kWh
    const costoM3 = 1200; // CLP o moneda local por m3

    const costoLuz = Math.round(baselineLuz * costoKwh);
    const costoAgua = Math.round(baselineAgua * costoM3);
    const gastoTotal = costoLuz + costoAgua;

    // Retornar el "Mapa de Gasto Estimado" en formato JSON (HU 1.3-3)
    return {
      baseline_luz_kwh: Math.round(baselineLuz),
      baseline_agua_m3: parseFloat(baselineAgua.toFixed(1)),
      costo_estimado_luz: costoLuz,
      costo_estimado_agua: costoAgua,
      gasto_total_estimado: gastoTotal,
      recomendaciones
    };
  }
}
