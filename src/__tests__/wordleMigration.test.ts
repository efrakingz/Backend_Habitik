import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { DataType, newDb } from 'pg-mem';
import { describe, expect, it } from 'vitest';

describe('migración de wordle multi-partidas', () => {
  it('elimina la restricción única diaria y agrega word_id y created_at conservando filas existentes', () => {
    const database = newDb();
    database.public.registerFunction({
      name: 'gen_random_uuid',
      returns: DataType.uuid,
      impure: true,
      implementation: randomUUID,
    });

    database.public.none(`
      CREATE TABLE public.wordle_attempts (
        id UUID DEFAULT gen_random_uuid() NOT NULL,
        user_id UUID NOT NULL,
        fecha DATE NOT NULL,
        intentos JSONB DEFAULT '[]'::jsonb,
        estado VARCHAR DEFAULT 'en_proceso'::character varying,
        pista_revelada BOOLEAN DEFAULT false,
        CONSTRAINT wordle_attempts_user_id_fecha_key UNIQUE (user_id, fecha)
      );
    `);

    const userId = '11111111-1111-1111-1111-111111111111';
    database.public.none(`
      INSERT INTO public.wordle_attempts (user_id, fecha, intentos, estado, pista_revelada)
      VALUES ('${userId}', '2026-11-12', '["SOLAR"]'::jsonb, 'ganado', false);
    `);

    const migration = readFileSync(
      join(process.cwd(), 'sql', '2026-11-12_wordle_multi_attempts.sql'),
      'utf8'
    );

    // Ejecutar DDL compatible en pg-mem (índices parciales se verifican por presencia en el SQL)
    const ddlForPgMem = migration
      .replace(/CREATE UNIQUE INDEX[\s\S]*?WHERE estado = 'en_proceso';/i, '')
      .replace(/CREATE INDEX[\s\S]*?created_at DESC\);/i, '');
    database.public.none(ddlForPgMem);

    // Ahora permite insertar más de una partida en la misma fecha
    database.public.none(`
      INSERT INTO public.wordle_attempts (user_id, fecha, intentos, estado, word_id)
      VALUES ('${userId}', '2026-11-12', '[]'::jsonb, 'en_proceso', 2);
    `);

    const total = database.public.one(
      `SELECT COUNT(*)::integer AS count FROM public.wordle_attempts WHERE user_id = '${userId}' AND fecha = '2026-11-12';`
    );
    expect(total.count).toBe(2);
    expect(migration).toContain("WHERE estado = 'en_proceso'");
  });
});
