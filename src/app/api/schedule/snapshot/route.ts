import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const SNAPSHOT_PATH = path.join(process.cwd(), 'data', 'schedule-snapshot.json');

export async function GET() {
  try {
    const raw = await fs.readFile(SNAPSHOT_PATH, 'utf-8');
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(null);
  }
}

export async function POST(request: NextRequest) {
  // Optional: protect with SCHEDULE_SECRET env var
  const secret = process.env.SCHEDULE_SECRET;
  if (secret) {
    const auth = request.headers.get('x-schedule-secret');
    if (auth !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const body = await request.json();
    await fs.mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
    await fs.writeFile(SNAPSHOT_PATH, JSON.stringify(body), 'utf-8');
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
