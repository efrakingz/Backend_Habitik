import { pool } from '../config/db';

export class ProfileService {
  /**
   * Actualiza el nombre y los atributos visuales del avatar (color, letra, url)
   */
  static async actualizarPerfil(
    userId: string, 
    nombre?: string, 
    color?: string, 
    letra?: string, 
    url?: string | null
  ) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Obtener el nombre y el objeto avatar actual bloqueando la fila
      const currentRes = await client.query(
        'SELECT nombre, avatar FROM public.profiles WHERE id = $1 FOR UPDATE;',
        [userId]
      );

      if (currentRes.rows.length === 0) {
        throw new Error('Perfil de usuario no encontrado en la base de datos.');
      }

      const currentProfile = currentRes.rows[0];
      const nuevoNombre = nombre !== undefined && nombre.trim() !== '' 
        ? nombre.trim() 
        : currentProfile.nombre;

      // 2. Fusionar las propiedades dentro del objeto JSONB avatar
      const avatarActual = currentProfile.avatar || { url: null, color: '#2e7d32', letra: 'A' };
      
      const nuevoAvatar = {
        ...avatarActual,
        ...(color !== undefined && { color }),
        ...(letra !== undefined && { letra: letra.toUpperCase().substring(0, 1) }), // Fuerza 1 sola letra mayúscula
        ...(url !== undefined && { url })
      };

      // 3. Ejecutar UPDATE en la tabla profiles
      const updateQuery = `
        UPDATE public.profiles
        SET nombre = $1, avatar = $2
        WHERE id = $3
        RETURNING id, nombre, email, rol, family_id, xp, monedas, nivel, avatar;
      `;
      const res = await client.query(updateQuery, [nuevoNombre, JSON.stringify(nuevoAvatar), userId]);

      await client.query('COMMIT');
      return res.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}