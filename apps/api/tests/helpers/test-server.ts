import { buildApp } from '../../src/app';

export async function buildTestApp() {
  const app = await buildApp();
  return app;
}
