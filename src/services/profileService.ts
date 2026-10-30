import { pool } from '../config/db';

export class ProfileService {
  /**
   * Actualiza el nombre, los atributos visuales del avatar (color, letra, url)
   * y el teléfono de contacto del usuario.
   * Retorna el perfil completo del usuario con información de familia y rachas.
   */
  static async actualizarPerfil(
    userId: string, 
    nombre?: string, 
    color?: string, 
    letra?: string, 
    url?: string | null,
    telefono?: string | null
  ) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Obtener el nombre, avatar y teléfono actual bloqueando la fila
      const currentRes = await client.query(
        'SELECT nombre, avatar, telefono FROM public.profiles WHERE id = $1 FOR UPDATE;',
        [userId]
      );

      if (currentRes.rows.length === 0) {
        throw new Error('Perfil de usuario no encontrado en la base de datos.');
      }

      const currentProfile = currentRes.rows[0];
      const nuevoNombre = nombre !== undefined && nombre.trim() !== '' 
        ? nombre.trim() 
        : currentProfile.nombre;

      const nuevoTelefono = telefono !== undefined
        ? (telefono === null || telefono.trim() === '' ? null : telefono.trim())
        : currentProfile.telefono;

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
        SET nombre = $1, avatar = $2, telefono = $3
        WHERE id = $4;
      `;
      await client.query(updateQuery, [nuevoNombre, JSON.stringify(nuevoAvatar), nuevoTelefono, userId]);

      // 4. Seleccionar el perfil completo enriquecido con la información del hogar
      const selectQuery = `
        SELECT 
          p.id, p.nombre, p.email, p.telefono, p.rol, p.family_id, p.xp, p.monedas, p.nivel, p.racha_dias, p.avatar,
          f.nombre AS family_name, f.family_code
        FROM public.profiles p
        LEFT JOIN public.families f ON f.id = p.family_id
        WHERE p.id = $1;
      `;
      const result = await client.query(selectQuery, [userId]);

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
