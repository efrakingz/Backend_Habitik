import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { DataType, newDb } from 'pg-mem';
import { describe, expect, it } from 'vitest';

describe('migración de trivia', () => {
  it('crea el esquema y carga cincuenta preguntas curadas', () => {
    const database = newDb();
    database.registerExtension('pgcrypto', (schema) => {
      schema.registerFunction({
        name: 'gen_random_uuid',
        returns: DataType.uuid,
        impure: true,
        implementation: randomUUID,
      });
    });
    database.public.registerFunction({
      name: 'jsonb_typeof',
      args: [DataType.jsonb],
      returns: DataType.text,
      implementation: (value: unknown) => Array.isArray(value) ? 'array' : typeof value,
    });
    database.public.registerFunction({
      name: 'jsonb_array_length',
      args: [DataType.jsonb],
      returns: DataType.integer,
      implementation: (value: unknown) => Array.isArray(value) ? value.length : 0,
    });
    database.public.none('CREATE TABLE profiles (id UUID PRIMARY KEY); CREATE TABLE families (id UUID PRIMARY KEY);');
    const migration = readFileSync(join(process.cwd(), 'sql', '2026-09-25_trivia.sql'), 'utf8');
    database.public.none(migration);

    const curated = database.public.one("SELECT COUNT(*)::integer AS count FROM trivia_questions WHERE fuente = 'curada';");
    const total = database.public.one('SELECT COUNT(*)::integer AS count FROM trivia_questions;');
    const invalid = database.public.one('SELECT COUNT(*)::integer AS count FROM trivia_questions WHERE jsonb_array_length(alternativas) <> 4;');

    expect(curated.count).toBe(50);
    expect(total.count).toBe(50);
    expect(invalid.count).toBe(0);
  });
});
