import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const USE_SUPABASE = process.env.DATABASE_PROVIDER === 'supabase';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string | null; // 'logo' | 'player'
    const id   = formData.get('id')   as string | null;

    if (!file || !type || !id) {
      return NextResponse.json({ error: 'file, type, and id are required' }, { status: 400 });
    }

    if (!['logo', 'player'].includes(type)) {
      return NextResponse.json({ error: 'type must be "logo" or "player"' }, { status: 400 });
    }

    const allowedMime = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    if (!allowedMime.includes(file.type)) {
      return NextResponse.json({ error: 'Only PNG, JPG, WEBP, GIF images are allowed' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be under 5 MB' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const mimeToExt: Record<string, string> = {
      'image/png':  'png',
      'image/jpeg': 'jpg',
      'image/jpg':  'jpg',
      'image/webp': 'webp',
      'image/gif':  'gif',
    };
    const ext = mimeToExt[file.type] || 'png';
    const folder = type === 'logo' ? 'logos' : 'players';
    const safeId = id.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const filename = `${safeId}.${ext}`;

    if (USE_SUPABASE) {
      // ── Supabase Storage (production / Vercel) ──────────────────────────────
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      );

      // Auto-create the bucket as PUBLIC if it doesn't exist yet
      const { data: existingBucket } = await supabase.storage.getBucket('images');
      if (!existingBucket) {
        const { error: createErr } = await supabase.storage.createBucket('images', {
          public: true,
          fileSizeLimit: 5 * 1024 * 1024,
        });
        if (createErr) {
          console.error('Failed to create images bucket:', createErr);
          return NextResponse.json({ error: 'Storage not configured: ' + createErr.message }, { status: 500 });
        }
      } else if (!existingBucket.public) {
        // Bucket exists but is private — make it public so URLs work
        await supabase.storage.updateBucket('images', { public: true });
      }

      const storagePath = `${folder}/${filename}`;
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(storagePath, buffer, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        console.error('Supabase Storage upload error:', uploadError);
        return NextResponse.json({ error: uploadError.message }, { status: 500 });
      }

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(storagePath);

      console.log('Upload success:', storagePath, '→', publicUrl);
      return NextResponse.json({ url: publicUrl, filename });
    } else {
      // ── Local filesystem (development / SQLite) ─────────────────────────────
      const dir = path.join(process.cwd(), 'public', folder);
      await mkdir(dir, { recursive: true });
      const filePath = path.join(dir, filename);
      await writeFile(filePath, buffer);
      const url = `/${folder}/${filename}?t=${Date.now()}`;
      return NextResponse.json({ url, filename });
    }
  } catch (e: any) {
    console.error('Upload error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
