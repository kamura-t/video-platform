import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { getActualFilePath } from '@/lib/file-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const filePath = resolvedParams.path.join('/');
    
    // NASのマウントポイントパスを構築
    const nasPath = getActualFilePath(`/videos/${filePath}`);
    
    // ファイルの存在確認
    if (!fs.existsSync(nasPath)) {
      console.warn(`File not found: ${nasPath}`);
      return new NextResponse('File not found', { status: 404 });
    }
    
    // ファイルの統計情報を取得
    const stats = fs.statSync(nasPath);
    
    // ファイルサイズが大きすぎる場合は拒否（セキュリティ対策）
    const maxFileSize = 100 * 1024 * 1024 * 1024; // 100GB
    if (stats.size > maxFileSize) {
      return new NextResponse('File too large', { status: 413 });
    }
    
    // ファイルのMIMEタイプを決定
    const ext = path.extname(nasPath).toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (ext) {
      case '.mp4':
        contentType = 'video/mp4';
        break;
      case '.webm':
        contentType = 'video/webm';
        break;
      case '.avi':
        contentType = 'video/x-msvideo';
        break;
      case '.mov':
        contentType = 'video/quicktime';
        break;
      case '.mkv':
        contentType = 'video/x-matroska';
        break;
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.webp':
        contentType = 'image/webp';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
    }
    
    // ファイルを読み込んでレスポンスを返す
    const fileBuffer = fs.readFileSync(nasPath);
    
    // レンジリクエストの処理
    const range = request.headers.get('range');
    if (range && contentType.startsWith('video/')) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunksize = (end - start) + 1;
      
      const head = {
        'Content-Range': `bytes ${start}-${end}/${stats.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize.toString(),
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
      };
      
      const stream = fs.createReadStream(nasPath, { start, end });
      return new NextResponse(stream as any, {
        status: 206,
        headers: head,
      });
    }
    
    // 通常のレスポンス
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': stats.size.toString(),
        'Cache-Control': 'public, max-age=31536000',
        'Accept-Ranges': 'bytes',
      },
    });
    
  } catch (error) {
    console.error('Video file serving error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
} 