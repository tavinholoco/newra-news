import { proxyToApi } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

/** Remove uma notícia (admin) — `DELETE /api/news/:id`. */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  return proxyToApi(request, `/news/${params.id}`, 'DELETE', {
    requireRole: 'ADMIN',
  });
}
