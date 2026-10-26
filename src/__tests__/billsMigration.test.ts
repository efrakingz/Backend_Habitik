import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataType, newDb } from 'pg-mem';
import { describe, expect, it } from 'vitest';

describe('migración de boletas confirmadas', () => {
  it('crea el esquema sin datos OCR y puede ejecutarse dos veces', () => {
    const database = newDb({ noAstCoverageCheck: true });
    database.registerExtension('pgcrypto', (schema) => {
      schema.registerFunction({ name: 'gen_random_uuid', returns: DataType.uuid, impure: true, implementation: randomUUID });
    });
    database.public.none('CREATE TABLE families (id UUID PRIMARY KEY);');
    const migration = readFileSync(join(process.cwd(), 'sql', '2026-10-26_bills_confirmed.sql'), 'utf8');

    database.public.none(migration);
    database.public.none(migration);

    const columns = database.public.many("SELECT column_name FROM information_schema.columns WHERE table_name = 'bills';").map((row) => row.column_name);
    expect(columns).toEqual(expect.arrayContaining(['family_id', 'service_type', 'provider_code', 'period_start', 'period_end', 'consumption', 'consumption_unit', 'amount_clp', 'due_date', 'entry_source']));
    expect(migration).toContain('DROP COLUMN IF EXISTS metadata');
    expect(migration).toContain('DROP COLUMN IF EXISTS ocr_result');
    expect(migration).toContain('DROP COLUMN IF EXISTS image_url');
  });
});
