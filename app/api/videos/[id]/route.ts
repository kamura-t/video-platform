import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateApiRequest } from '@/lib/auth';
import { getActualFilePath } from '@/lib/file-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    
    // 動画IDまたはvideoIdで検索
    const video = await prisma.video.findFirst({
      where: {
        OR: [
          // idが数値の場合のみ検索
          ...(isNaN(parseInt(id)) ? [] : [{ id: parseInt(id) }]),
          { videoId: id }
        ]
      },
      select: {
        id: true,
        videoId: true,
        title: true,
        description: true,
        uploadType: true,
        originalFilename: true,
        filePath: true,
        convertedFilePath: true,
        fileSize: true,
        mimeType: true,
        youtubeUrl: true,
        youtubeVideoId: true,
        youtubeViewCount: true,
        thumbnailUrl: true,
        duration: true,
        viewCount: true,
        visibility: true,
        status: true,
        // 動画メタデータ
        videoResolution: true,
        videoCodec: true,
        videoBitrate: true,
        videoFrameRate: true,
        audioCodec: true,
        audioBitrate: true,
        audioSampleRate: true,
        audioChannels: true,
        convertedFileSize: true,
        compressionRatio: true,
        createdAt: true,
        updatedAt: true,
        publishedAt: true,
        uploader: {
          select: {
            id: true,
            username: true,
            displayName: true,
            profileImageUrl: true,
          }
        },
        categories: {
          include: {
            category: true
          }
        },
        tags: {
          include: {
            tag: true
          }
        },
        transcodeJobs: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1,
          select: {
            id: true,
            jobId: true,
            videoId: true,
            inputFile: true,
            outputFile: true,
            preset: true,
            status: true,
            progress: true,
            errorMessage: true,
            startedAt: true,
            completedAt: true,
            createdAt: true,
            updatedAt: true
          }
        }
      }
    });

    if (!video) {
      return NextResponse.json(
        { success: false, error: '動画が見つかりません' },
        { status: 404 }
      );
    }

    // ファイルの存在確認
    const fs = require('fs');
    const path = require('path');
    
    let fileExists = false;
    let convertedFileExists = false;
    
    try {
      if (video.filePath) {
        const fullPath = getActualFilePath(video.filePath);
        fileExists = fs.existsSync(fullPath);
      }
      
      if (video.convertedFilePath) {
        const fullPath = getActualFilePath(video.convertedFilePath);
        convertedFileExists = fs.existsSync(fullPath);
      }
    } catch (fileError) {
      // ファイル存在確認に失敗しても処理を続行
    }

    // BigIntを文字列に変換する関数
    const serializeBigInt = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj === 'bigint') return obj.toString();
      if (Array.isArray(obj)) return obj.map(serializeBigInt);
      if (typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = serializeBigInt(value);
        }
        return result;
      }
      return obj;
    };

    const serializedVideo = serializeBigInt(video);

    return NextResponse.json({
      success: true,
      data: {
        ...serializedVideo,
        createdAt: video.createdAt, // 明示的に追加
        fileExists,
        convertedFileExists,
        debug: {
          createdAt: {
            value: video.createdAt,
            type: typeof video.createdAt,
            isDate: video.createdAt instanceof Date,
            toISOString: video.createdAt instanceof Date ? video.createdAt.toISOString() : 'N/A'
          }
        }
      }
    });

  } catch (error) {
    console.error('Video fetch error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      name: error instanceof Error ? error.name : 'Unknown'
    });
    return NextResponse.json(
      { success: false, error: '動画データの取得に失敗しました' },
      { status: 500 }
    );
  }
} 