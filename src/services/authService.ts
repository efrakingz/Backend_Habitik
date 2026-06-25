import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import { UserRepository } from '../repositories/userRepository';
import { FamilyRepository } from '../repositories/familyRepository';
import { Profile } from '../models/types';

const userRepository = new UserRepository();
const familyRepository = new FamilyRepository();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_12345';

// Generador de código familiar de 6 caracteres
const generateFamilyCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export class AuthService {
  async register(email: string, password: string, nombre: string, nombreFamilia: string) {
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw new Error('EMAIL_EXISTS');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Hashear contraseña
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // 2. Crear usuario
      const userId = await userRepository.createUser(email, passwordHash, client);

      // 3. Crear hogar (familia)
      let familyCode = generateFamilyCode();
      const family = await familyRepository.createFamily(nombreFamilia, familyCode, client);

      // 4. Crear perfil de Jefe de Familia ('Jefe')
      const profile = await userRepository.createProfile({
        id: userId,
        email,
        nombre,
        avatar_letra: nombre.charAt(0).toUpperCase(),
        avatar_color: '#2e7d32',
        rol: 'Jefe', // rol de la BD
        xp: 0,
        nivel: 1,
        monedas: 0
      }, client);

      // Vincular el perfil a la familia
      await familyRepository.updateProfileFamily(userId, family.id, 'Jefe', client);

      await client.query('COMMIT');

      // 5. Generar token JWT según CA-1.1-3
      // Payload: {user_id, family_id, role: "admin"} y expiración 24h
      const tokenPayload = {
        user_id: userId,
        family_id: family.id,
        role: 'admin' // Para el Jefe de Familia en el JWT
      };

      const token_jwt = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

      return {
        user_id: userId,
        family_id: family.id,
        token_jwt
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async login(email: string, password: string) {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const profile = await userRepository.getProfileById(user.id);
    if (!profile) {
      throw new Error('PROFILE_NOT_FOUND');
    }

    // Rol en JWT payload es 'admin' para Jefe, y 'miembro' para Miembros
    const roleInJwt = profile.rol === 'Jefe' || profile.rol === 'admin' ? 'admin' : 'miembro';

    const tokenPayload = {
      user_id: user.id,
      family_id: profile.family_id,
      role: roleInJwt
    };

    const token_jwt = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

    return {
      user_id: user.id,
      family_id: profile.family_id,
      token_jwt,
      profile
    };
  }
}
