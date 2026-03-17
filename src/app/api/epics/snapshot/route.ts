import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const SNAPSHOT_PATH = path.join(process.cwd(), 'data', 'epics-snapshot.json');

export async function GET() {
  try {
    const raw = await fs.readFile(SNAPSHOT_PATH, 'utf-8');
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json(null);
  }
}

export async function POST(request: Request) {
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
