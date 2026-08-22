import { proxyToApi } from '@/lib/api-proxy';

export async function GET(request: Request) {
  return proxyToApi(request, '/account/preferences');
}

export async function PUT(request: Request) {
  return proxyToApi(request, '/account/preferences', 'PUT');
}
