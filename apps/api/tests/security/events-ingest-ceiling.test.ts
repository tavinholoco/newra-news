import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { PRODUCT_EVENT_BATCH_MAX } from '@newranews/types';
import { buildTestApp } from '../helpers/test-server';

/**
 * **O teto da ingestão é agregado, não por leitor — e o número tem de continuar
 * sendo uma decisão.**
 *
 * A §11.5 pede os eventos hop a hop. O hop que quase ninguém olha é o do rate
 * limit, porque a sua falha não tem sintoma: um 429 num `sendBeacon` não devolve
 * nada que o cliente leia, então a tela de métricas subconta e nada acusa.
 *
 * A Fase 9 mediu que o balde era **um só para a internet inteira** e consertou
 * com `trustProxy: 1`. Esta fase mediu o caminho que sobrou, que é justamente o
 * que carrega o tráfego: navegador → BFF do Next → API. O IP que chega aqui é o
 * da função da Vercel. Em produção, 24/08/2026, três requisições diretas
 * consumiram o balde do meu IP enquanto três pelo BFF não o tocaram — e 45
 * requisições pelo BFF em 12 s devolveram 10 × 400 e **35 × 429**.
 *
 * O que esta guarda trava é o par de números, junto: o teto de requisições e o
 * teto de eventos por requisição **multiplicam-se**, e mexer num sem olhar o
 * outro muda a exposição sem que ninguém perceba. A conta está escrita ao lado
 * da rota.
 */

const ROUTE_PATH = join(__dirname, '../../src/routes/events/index.ts');

/** Eventos por minuto que um único balde admite. */
const EVENTS_PER_MINUTE_CEILING = 30 * PRODUCT_EVENT_BATCH_MAX;

/** A dívida de agregação da `/metrics/product` dói aos 200.000 (item 34). */
const AGGREGATION_DEBT_ROWS = 200_000;

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('teto de ingestão de eventos', () => {
  it('keeps the declared ceiling at the number the comment reasons about', () => {
    const route = app
      .printRoutes({ commonPrefix: false })
      .includes('events');
    expect(route).toBe(true);

    const source = readFileSync(ROUTE_PATH, 'utf8');
    expect(source).toMatch(/rateLimit:\s*\{\s*max:\s*30,\s*timeWindow:\s*'1 minute'\s*\}/);
  });

  it('states that the bucket is shared, not per reader', () => {
    // O defeito concreto desta fase foi um **comentário** que afirmava
    // "30/min por IP" sobre um controle que, no caminho real, é agregado.
    // Comentário errado sobre controle de segurança é achado, não estilo.
    const source = readFileSync(ROUTE_PATH, 'utf8');

    expect(source).toMatch(/não é por leitor|balde é um só/);
    expect(source).toContain('metrics/http');
  });

  it('keeps the two ceilings multiplying to a number someone decided', () => {
    // 600 eventos/min. Se o lote subir para 100 sem ninguém mexer no teto de
    // requisições, isto vira 3.000/min e a dívida de agregação passa a ser
    // alcançável em pouco mais de uma hora — sem uma linha de decisão escrita.
    expect(EVENTS_PER_MINUTE_CEILING).toBe(600);

    const hoursToDebtTrigger = AGGREGATION_DEBT_ROWS / (EVENTS_PER_MINUTE_CEILING * 60);
    expect(hoursToDebtTrigger).toBeGreaterThan(5);
  });

  it('refuses a batch above the declared maximum', async () => {
    const base = {
      sessionId: '11111111-1111-4111-8111-111111111111',
      locale: 'pt-BR',
      path: '/pt-BR',
      occurredAt: new Date().toISOString(),
      type: 'homepage_view' as const,
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: { events: Array.from({ length: PRODUCT_EVENT_BATCH_MAX + 1 }, () => base) },
    });

    expect(response.statusCode).toBe(400);
  });
});
