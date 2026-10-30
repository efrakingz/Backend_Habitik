import { pool } from '../config/db';
import { RewardCatalogService } from './rewards/rewardCatalogService';
import { RewardProposalService } from './rewards/rewardProposalService';
import { RewardRedemptionService } from './rewards/rewardRedemptionService';
import { RewardColectaService } from './rewards/rewardColectaService';

const catalogService = new RewardCatalogService();
const proposalService = new RewardProposalService();
const redemptionService = new RewardRedemptionService();
const colectaService = new RewardColectaService();

/**
 * Facade unificada de Recompensas (Tienda, Propuestas, Canjes Personales y Colectas Colaborativas).
 * Delega internamente en sub-servicios modulares.
 */
export class RewardService {
  async getRewardsByFamily(familyId: string, currentUserId?: string) {
    return catalogService.getRewardsByFamily(familyId, currentUserId);
  }

  async createReward(
    userId: string,
    userRole: string,
    familyId: string,
    data: { titulo: string; descripcion: string; emoji?: string; costo: number; es_familiar: boolean; metadata?: any },
    io?: any
  ) {
    return catalogService.createReward(userId, userRole, familyId, data, io);
  }

  async proposeReward(
    userId: string,
    familyId: string,
    data: { titulo: string; descripcion?: string; emoji?: string },
    io?: any
  ) {
    return proposalService.proposeReward(userId, familyId, data, io);
  }

  async getPendingProposals(familyId: string) {
    return proposalService.getPendingProposals(familyId);
  }

  async approveProposal(
    adminRole: string,
    familyId: string,
    rewardId: string | number,
    costo: number,
    options?: {
      es_familiar?: boolean;
      titulo?: string;
      descripcion?: string;
      icono?: string;
      emoji?: string;
    },
    io?: any
  ) {
    return proposalService.approveProposal(adminRole, familyId, rewardId, costo, options, io);
  }

  async rejectProposal(
    adminRole: string,
    familyId: string,
    rewardId: string | number,
    motivo?: string,
    io?: any
  ) {
    return proposalService.rejectProposal(adminRole, familyId, rewardId, motivo, io);
  }

  async startOrContributeColecta(
    userId: string,
    familyId: string,
    rewardId: string | number,
    io?: any
  ) {
    return colectaService.startOrContributeColecta(userId, familyId, rewardId, io);
  }

  async redeemReward(userId: string, rewardId: string | number, io?: any) {
    return redemptionService.redeemReward(userId, rewardId, io);
  }

  async getPendingCanjes(familyId: string) {
    return redemptionService.getPendingCanjes(familyId);
  }

  async approveCanje(adminRole: string, canjeId: string | number, io?: any) {
    return redemptionService.approveCanje(adminRole, canjeId, io);
  }

  async rejectCanje(adminRole: string, canjeId: string | number, motivo?: string, io?: any) {
    return redemptionService.rejectCanje(adminRole, canjeId, motivo, io);
  }

  /**
   * Reclamar recompensa de 10 monedas por cada nivel subido.
   */
  static async reclamarRecompensaNivel(userId: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const profRes = await client.query(
        `SELECT nivel, ultimo_nivel_reclamado, monedas FROM public.profiles WHERE id = $1 FOR UPDATE;`,
        [userId]
      );

      if (profRes.rows.length === 0) throw new Error('Perfil no encontrado.');

      const perfil = profRes.rows[0];
      const nivelActual = perfil.nivel || 1;
      const ultimoReclamado = perfil.ultimo_nivel_reclamado || 1;
      const nivelesPorCobrar = nivelActual - ultimoReclamado;

      if (nivelesPorCobrar <= 0) {
        await client.query('ROLLBACK');
        return {
          exito: false,
          mensaje: 'No tienes nuevas recompensas de nivel pendientes por reclamar.'
        };
      }

      const monedasGanadas = nivelesPorCobrar * 10;
      const nuevoSaldo = (perfil.monedas || 0) + monedasGanadas;

      await client.query(`
        UPDATE public.profiles 
        SET monedas = $1, ultimo_nivel_reclamado = $2 
        WHERE id = $3;
      `, [nuevoSaldo, nivelActual, userId]);

      await client.query(`
        INSERT INTO public.historial_gamificacion (user_id, origen_actividad, monedas_otorgadas, xp_otorgada)
        VALUES ($1, 'recompensa_nivel', $2, 0);
      `, [userId, monedasGanadas]);

      await client.query('COMMIT');

      return {
        exito: true,
        mensaje: `¡Has reclamado ${monedasGanadas} monedas por subir ${nivelesPorCobrar} nivel(es)!`,
        monedas_ganadas: monedasGanadas,
        nuevo_saldo: nuevoSaldo,
        ultimo_nivel_reclamado: nivelActual
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
