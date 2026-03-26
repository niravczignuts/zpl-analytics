import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export const config = { api: { bodyParser: false } };

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string | null; // 'logo' | 'player'
    const id   = formData.get('id')   as string | null;

    if (!file || !type || !id) {
      return NextResponse.json({ error: 'file, type, and id are required' }, { status: 400 });
    }

    // Validate type
    if (!['logo', 'player'].includes(type)) {
      return NextResponse.json({ error: 'type must be "logo" or "player"' }, { status: 400 });
    }

    // Validate file type
    const allowedMime = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    if (!allowedMime.includes(file.type)) {
      return NextResponse.json({ error: 'Only PNG, JPG, WEBP, GIF images are allowed' }, { status: 400 });
    }

    // Max 5 MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be under 5 MB' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Determine extension from mime type
    const mimeToExt: Record<string, string> = {
      'image/png':  'png',
      'image/jpeg': 'jpg',
      'image/jpg':  'jpg',
      'image/webp': 'webp',
      'image/gif':  'gif',
    };
    const ext = mimeToExt[file.type] || 'png';
    const folder = type === 'logo' ? 'logos' : 'players';

    // Sanitize id for filesystem safety
    const safeId = id.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const filename = `${safeId}.${ext}`;

    const dir = path.join(process.cwd(), 'public', folder);
    await mkdir(dir, { recursive: true });

    const filePath = path.join(dir, filename);
    await writeFile(filePath, buffer);

    const url = `/${folder}/${filename}?t=${Date.now()}`;
    return NextResponse.json({ url, filename });
  } catch (e: any) {
    console.error('Upload error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
