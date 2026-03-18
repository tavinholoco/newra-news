import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const jobUrl = process.env.BACKEND_JOB_URL;
  if (!jobUrl) {
    return NextResponse.json(
      { success: false, error: 'BACKEND_JOB_URL not configured' },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(jobUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.BACKEND_JOB_SECRET}`,
      },
    });

    const data = await response.json();
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Pipeline trigger failed' },
      { status: 500 },
    );
  }
}
