/**
 * As retenções da etapa 8 que não têm service próprio, nomeadas.
 *
 * Eram literais dentro da etapa (`thirtyDaysAgo`, `ninetyDaysAgo`), e o número
 * de cada uma está escrito em prosa em quatro documentos que a etapa não abre
 * — os dois diagramas do pipeline e os dois `CLAUDE.md`. A guarda
 * `tests/docs/retention-drift.test.ts` compara a prosa com estas constantes
 * (e com as dos outros quatro services), pela mesma razão do `13` dos feeds:
 * número que descreve código quer guarda derivada do código.
 *
 * **Moram aqui, e não no `pipeline.service.ts`, desde a Fase 6**: os
 * invariantes de retenção perguntam por estes números, e o
 * `invariants.service` não pode importar o pipeline — é o pipeline que o
 * importa. As outras retenções seguem em cada service (`ERROR_EVENT`,
 * `AUDIT_EVENT`, `SOURCE_HEALTH`) e em `@newranews/types` (`PRODUCT_EVENT`);
 * estas três são de tabelas cujo expurgo é inline na etapa 8.
 */
export const NEWS_RETENTION_DAYS = 30;
export const PIPELINE_LOG_RETENTION_DAYS = 30;
export const ARTICLE_RETENTION_DAYS = 90;
