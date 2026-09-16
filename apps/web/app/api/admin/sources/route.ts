import { proxyToApi } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

/**
 * A saúde de cada fonte, um dia de cada vez (admin) — `GET /api/admin/sources`.
 *
 * A tabela que o 11a criou e o pipeline escreve desde o 11b (§15 do plano de
 * observabilidade). O painel "Fontes" da aba Métricas desenha a partir daqui:
 * a tabela por fonte com médias e variação, a faixa de 30 dias por fonte e a
 * rosquinha de contribuição por `kept`.
 *
 * `days` é repassado na query e **validado pela API**, nunca aqui — o teto é
 * a retenção (90), e dois validadores para o mesmo parâmetro discordam no dia
 * em que um deles mudar.
 */
export async function GET(request: Request) {
  return proxyToApi(request, '/admin/sources', 'GET', { requireRole: 'ADMIN' });
}
