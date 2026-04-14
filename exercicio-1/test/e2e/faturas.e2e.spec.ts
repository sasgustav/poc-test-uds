/**
 * E2E feliz-path + idempotência + tenant isolation.
 *
 * Nota: não roda em CI padrão (`testPathIgnorePatterns: /test/e2e/`). Executar
 * com `npm run test:e2e`. Requer Postgres real (docker-compose up -d postgres).
 * pg-mem foi retirado — não cobre advisory locks nem SELECT...FOR UPDATE
 * SKIP LOCKED, então mascarava bugs de concorrência que só aparecem em prod.
 */
import type { INestApplication} from '@nestjs/common';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Faturas E2E', () => {
  let app: INestApplication;
  const userId = '00000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = mod.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /v1/faturas cria fatura + retorna Location + ETag', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/faturas')
      .set('X-User-Id', userId)
      .send({
        nomeDevedor: 'Maria Silva',
        emailDevedor: 'maria@example.com',
        descricao: 'Fatura teste',
        valor: 150.5,
        dataVencimento: '2026-06-15',
      })
      .expect(201);
    expect(res.header['location']).toMatch(/^\/v1\/faturas\//);
    expect(res.header['etag']).toBeDefined();
    expect(res.body.lembretes).toHaveLength(3);
  });

  it('Idempotency-Key: retries retornam mesma resposta', async () => {
    const key = 'e2e-test-key-123';
    const payload = {
      nomeDevedor: 'João',
      emailDevedor: 'joao@example.com',
      descricao: 'Fat',
      valor: 100,
      dataVencimento: '2026-07-01',
    };
    const r1 = await request(app.getHttpServer())
      .post('/v1/faturas')
      .set('X-User-Id', userId)
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(201);
    const r2 = await request(app.getHttpServer())
      .post('/v1/faturas')
      .set('X-User-Id', userId)
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(201);
    expect(r2.body.id).toBe(r1.body.id);
    expect(r2.header['idempotent-replay']).toBe('true');
  });

  it('tenant isolation: user-B não lê fatura de user-A (404)', async () => {
    const userA = '11111111-1111-1111-1111-111111111111';
    const userB = '22222222-2222-2222-2222-222222222222';
    const created = await request(app.getHttpServer())
      .post('/v1/faturas')
      .set('X-User-Id', userA)
      .send({
        nomeDevedor: 'A',
        emailDevedor: 'a@a.com',
        descricao: 'desc',
        valor: 10,
        dataVencimento: '2026-08-01',
      })
      .expect(201);
    await request(app.getHttpServer())
      .get(`/v1/faturas/${created.body.id}`)
      .set('X-User-Id', userB)
      .expect(404);
  });
});
