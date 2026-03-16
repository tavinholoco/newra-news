import { prisma } from '@newranews/database';

export async function triggerPipeline(): Promise<string> {
  const log = await prisma.pipelineLog.create({
    data: { status: 'RUNNING' },
  });

  // Fire-and-forget: execução real será implementada nos próximos itens da Fase 2
  void runPipeline(log.id).catch((err: unknown) => {
    console.error(`[pipeline] unhandled error for log ${log.id}:`, err);
  });

  return log.id;
}

async function runPipeline(pipelineLogId: string): Promise<void> {
  // TODO: Implementar os 9 estágios do pipeline:
  // 1. Coletar notícias (NewsAPI + RSS)
  // 2. Normalizar dados
  // 3. Deduplicar
  // 4. Persistir notícias
  // 5. Selecionar top por categoria
  // 6. Gerar artigo via AI
  // 7. Persistir artigo
  // 8. Cleanup de dados antigos
  // 9. Registrar métricas diárias
  await prisma.pipelineLog.update({
    where: { id: pipelineLogId },
    data: {
      status: 'FAILED',
      error: 'Pipeline not yet implemented',
      completedAt: new Date(),
    },
  });
}
