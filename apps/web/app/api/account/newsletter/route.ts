import { proxyToApi } from '@/lib/api-proxy';

export async function PUT(request: Request) {
  return proxyToApi(request, '/account/newsletter', 'PUT');
}
