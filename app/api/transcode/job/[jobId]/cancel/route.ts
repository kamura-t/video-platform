import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { gpuTranscoderClient } from '@/lib/gpu-transcoder'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

interface JWTPayload {
  userId: number
  username: string
  role: string
  email: string
  iat: number
  exp: number
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const resolvedParams = await params
    const { jobId } = resolvedParams
    
    // 認証チェック
    const cookieToken = request.cookies.get('auth-token')?.value
    const authHeader = request.headers.get('authorization')
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null
    
    const token = cookieToken || headerToken

    if (!token) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // トークン検証
    let payload: JWTPayload
    try {
      payload = jwt.verify(token, JWT_SECRET) as JWTPayload
    } catch (error) {
      return NextResponse.json({ error: '無効なトークンです' }, { status: 401 })
    }

    // データベースから変換ジョブ情報を取得
    const transcodeJob = await (prisma as any).transcodeJob.findUnique({
      where: { jobId },
      include: {
        video: {
          select: {
            videoId: true,
            title: true,
            uploaderId: true
          }
        }
      }
    })

    if (!transcodeJob) {
      return NextResponse.json({ error: '変換ジョブが見つかりません' }, { status: 404 })
    }

    // 権限チェック：管理者または投稿者のみキャンセル可能
    if (payload.role.toLowerCase() !== 'admin' && transcodeJob.video.uploaderId !== payload.userId) {
      return NextResponse.json({ error: 'キャンセル権限がありません' }, { status: 403 })
    }

    // 既に完了またはキャンセル済みの場合
    if (transcodeJob.status === 'COMPLETED' || transcodeJob.status === 'CANCELLED') {
      return NextResponse.json({ 
        error: `変換ジョブは既に${transcodeJob.status === 'COMPLETED' ? '完了' : 'キャンセル'}済みです` 
      }, { status: 400 })
    }

    try {
      // GPU変換サーバーでジョブをキャンセル（実装されている場合）
      // 注: GPU変換サーバーAPIにキャンセル機能があれば呼び出す
      console.log(`Attempting to cancel GPU job: ${jobId}`)
      
      // データベースでジョブをキャンセル状態に更新
      const updatedJob = await (prisma as any).transcodeJob.update({
        where: { jobId },
        data: {
          status: 'CANCELLED',
          completedAt: new Date(),
          errorMessage: 'ユーザーによってキャンセルされました'
        }
      })

      // 動画レコードを更新（元ファイルを使用）
      await prisma.video.update({
        where: { id: transcodeJob.videoId },
        data: {
          status: 'COMPLETED' // 元ファイルで配信
        }
      })

      console.log(`Transcode job ${jobId} cancelled successfully`)

      return NextResponse.json({
        success: true,
        message: '変換ジョブがキャンセルされました',
        data: {
          ...updatedJob,
          originalFileSize: updatedJob.originalFileSize?.toString(),
          convertedFileSize: updatedJob.convertedFileSize?.toString(),
          videoId: updatedJob.videoId.toString()
        }
      })

    } catch (error) {
      console.error('Failed to cancel transcode job:', error)
      return NextResponse.json(
        { 
          success: false, 
          error: '変換ジョブのキャンセルに失敗しました' 
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Cancel job API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'キャンセル処理に失敗しました' 
      },
      { status: 500 }
    )
  }
} 