// Sets mock env vars before any module is imported by tests.
// Real values are not needed — all tests use it.todo() stubs.
// CI env vars (e.g. DATABASE_URL) take precedence via ??=.
process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/newranews_test';
process.env.NEWSAPI_KEY ??= 'test-newsapi-key';
process.env.GEMINI_API_KEY ??= 'test-gemini-key';
process.env.GROQ_API_KEY ??= 'test-groq-key';
process.env.JOB_SECRET ??= 'test-job-secret';
