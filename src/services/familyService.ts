import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/db';
import { FamilyRepository } from '../repositories/familyRepository';
import { QrRepository } from '../repositories/qrRepository';

const familyRepository = new FamilyRepository();
const qrRepository = new QrRepository();

export class FamilyService {
  async generateInviteToken(familyId: string) {
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos de TTL (CA-1.2-1)
    
    const qrToken = await qrRepository.createInviteToken(familyId, token, expiresAt);
    return qrToken;
  }

  async joinFamily(inviteToken: string, userId: string) {
    const qrToken = await qrRepository.findInviteToken(inviteToken);
    
    // Validar token: CA-1.2-3 (Expirado o usado -> 410 Gone)
    if (!qrToken || qrToken.used || new Date(qrToken.expires_at) < new Date()) {
      throw new Error('TOKEN_EXPIRED_OR_USED');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Vincular al usuario al Family_ID y asignarle el rol 'Miembro' (CA-1.2-2)
      await familyRepository.updateProfileFamily(userId, qrToken.family_id, 'Miembro', client);

      // Marcar token QR como usado
      await qrRepository.markTokenAsUsed(inviteToken, client);

      await client.query('COMMIT');

      const family = await familyRepository.findById(qrToken.family_id);
      return family;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateFamilyName(familyId: string, nombre: string) {
    const family = await familyRepository.findById(familyId);
    if (!family) {
      throw new Error('FAMILY_NOT_FOUND');
    }

    // CA-1.1-2: Bloqueo de 60 días desde la creación
    // Comentado temporalmente para permitir configurar el nombre real del hogar durante el onboarding
    /*
    const createdTime = new Date(family.created_at).getTime();
    const currentTime = Date.now();
    const diffDays = (currentTime - createdTime) / (1000 * 60 * 60 * 24);

    if (diffDays < 60) {
      throw new Error('FAMILY_NAME_LOCKED');
    }
    */

    const updatedFamily = await familyRepository.updateFamilyName(familyId, nombre);
    return updatedFamily;
  }
}
