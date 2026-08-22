import { proxyToApi } from '@/lib/api-proxy';

export async function GET(request: Request) {
  return proxyToApi(request, '/favorites');
}

export async function POST(request: Request) {
  return proxyToApi(request, '/favorites', 'POST');
}
