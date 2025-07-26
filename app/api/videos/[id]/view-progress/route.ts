import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'
import { verifyToken } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const videoId = resolvedParams.id;
    const { watchDuration, completionRate } = await request.json()
    
    // バリデーション
    if (typeof watchDuration !== 'number' || typeof completionRate !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters' },
        { status: 400 }
      )
    }
    
    // 動画情報を取得
    const video = await prisma.video.findUnique({
      where: { videoId: videoId },
      select: { id: true, duration: true, viewCount: true }
    })
    
    if (!video) {
      return NextResponse.json(
        { success: false, error: 'Video not found' },
        { status: 404 }
      )
    }
    
    // システム設定から閾値を取得
    const [percentSetting, secondsSetting, hoursSetting] = await Promise.all([
      prisma.systemSetting.findUnique({
        where: { settingKey: 'view_count_threshold_percent' }
      }),
      prisma.systemSetting.findUnique({
        where: { settingKey: 'view_count_threshold_seconds' }
      }),
      prisma.systemSetting.findUnique({
        where: { settingKey: 'view_duplicate_hours' }
      })
    ])
    
    // デフォルト値を設定
    const thresholdPercent = percentSetting?.settingValue ? parseInt(percentSetting.settingValue) : 30
    const thresholdSeconds = secondsSetting?.settingValue ? parseInt(secondsSetting.settingValue) : 600
    const duplicateHours = hoursSetting?.settingValue ? parseInt(hoursSetting.settingValue) : 24
    
    // セッションIDを生成（watch pageと同じロジック）
    const headersList = await headers()
    const userAgent = headersList.get('user-agent') || ''
    const forwardedFor = headersList.get('x-forwarded-for') || ''
    const realIp = headersList.get('x-real-ip') || ''
    
    const sessionData = `${forwardedFor || realIp || 'unknown'}-${userAgent}`
    const sessionId = Buffer.from(sessionData).toString('base64').substring(0, 64)

    // 認証ユーザーを確認
    let currentUser = null
    const authToken = request.cookies.get('auth-token')?.value
    if (authToken) {
      try {
        currentUser = verifyToken(authToken)
      } catch (error) {
        // 認証エラーは無視して匿名として続行
        console.log('認証トークンの検証に失敗:', error)
      }
    }
    
    // 指定時間以内の視聴ログを取得
    const hoursAgo = new Date(Date.now() - duplicateHours * 60 * 60 * 1000)
    const viewLog = await prisma.viewLog.findFirst({
      where: {
        videoId: video.id,
        sessionId: sessionId,
        viewedAt: {
          gte: hoursAgo
        }
      },
      orderBy: {
        viewedAt: 'desc'
      }
    })
    
    let currentViewLog = viewLog
    if (!currentViewLog) {
      // 視聴ログが存在しない場合は新しく作成
      currentViewLog = await prisma.viewLog.create({
        data: {
          videoId: video.id,
          sessionId: sessionId,
          userAgent: userAgent || null,
          watchDuration: watchDuration,
          completionRate: completionRate,
          referrer: headersList.get('referer') || null,
          viewCountUpdated: false, // 初回は未更新
          viewedAt: new Date()
        }
      })
      
      console.log(`視聴ログを新規作成: videoId=${video.id}, sessionId=${sessionId}`)
    }
    
    // 視聴ログを更新
    await prisma.viewLog.update({
      where: { id: currentViewLog.id },
      data: {
        watchDuration: watchDuration,
        completionRate: completionRate
      }
    })

    // 認証ユーザーの場合、ViewHistory（サマリー）とDailyViewHistory（詳細）を更新
    if (currentUser && currentUser.userId) {
      try {
        const userId = parseInt(currentUser.userId)
        const now = new Date()
        const today = new Date(now.toDateString()) // 今日の日付（00:00:00）
        
        // ViewHistory（サマリー）の更新
        const existingViewHistory = await prisma.viewHistory.findUnique({
          where: {
            userId_videoId: {
              userId: userId,
              videoId: video.id
            }
          }
        })

        if (existingViewHistory) {
          // 既存レコードを更新（より長い視聴時間、より高い完了率を保持）
          await prisma.viewHistory.update({
            where: { id: existingViewHistory.id },
            data: {
              watchDuration: Math.max(existingViewHistory.watchDuration || 0, watchDuration),
              completionRate: existingViewHistory.completionRate 
                ? Math.max(parseFloat(existingViewHistory.completionRate.toString()), completionRate)
                : completionRate,
              lastWatchedAt: now
            }
          })
          
          console.log(`ViewHistory更新: userId=${userId}, videoId=${video.id}`)
        } else {
          // 新規ViewHistoryレコードを作成
          await prisma.viewHistory.create({
            data: {
              userId: userId,
              videoId: video.id,
              watchDuration: watchDuration,
              completionRate: completionRate,
              lastWatchedAt: now
            }
          })
          
          console.log(`ViewHistory作成: userId=${userId}, videoId=${video.id}`)
        }

        // DailyViewHistory（日付単位の詳細履歴）の更新
        const existingDailyHistory = await prisma.dailyViewHistory.findUnique({
          where: {
            userId_videoId_viewDate: {
              userId: userId,
              videoId: video.id,
              viewDate: today
            }
          }
        })

        if (existingDailyHistory) {
          // 今日の履歴を更新（より長い視聴時間、より高い完了率、セッション数を増加）
          await prisma.dailyViewHistory.update({
            where: { id: existingDailyHistory.id },
            data: {
              watchDuration: Math.max(existingDailyHistory.watchDuration || 0, watchDuration),
              completionRate: existingDailyHistory.completionRate 
                ? Math.max(parseFloat(existingDailyHistory.completionRate.toString()), completionRate)
                : completionRate,
              sessionCount: existingDailyHistory.sessionCount + 1,
              viewTime: now, // 最新の視聴時刻を更新
              userAgent: userAgent || existingDailyHistory.userAgent,
              referrer: headersList.get('referer') || existingDailyHistory.referrer
            }
          })
          
          console.log(`DailyViewHistory更新: userId=${userId}, videoId=${video.id}, date=${today.toDateString()}`)
        } else {
          // 今日の新規履歴を作成
          await prisma.dailyViewHistory.create({
            data: {
              userId: userId,
              videoId: video.id,
              viewDate: today,
              viewTime: now,
              watchDuration: watchDuration,
              completionRate: completionRate,
              sessionCount: 1,
              deviceType: null, // 必要に応じてUser-Agentから判定
              referrer: headersList.get('referer') || null,
              userAgent: userAgent || null
            }
          })
          
          console.log(`DailyViewHistory作成: userId=${userId}, videoId=${video.id}, date=${today.toDateString()}`)
        }

      } catch (error) {
        // ViewHistory更新エラーは視聴進捗更新に影響しないよう警告のみ
        console.warn('ViewHistory更新エラー:', error)
      }
    }
    
    // view_count更新の判定（システム設定に基づく）
    const shouldUpdateViewCount = 
      completionRate >= thresholdPercent || // 設定された%以上視聴
      watchDuration >= thresholdSeconds    // 設定された秒数以上視聴
    
    let viewCountUpdated = false
    
    // 閾値に達している かつ まだ視聴回数を更新していない場合のみ更新
    if (shouldUpdateViewCount && !currentViewLog.viewCountUpdated) {
      await prisma.$transaction(async (tx) => {
        // 視聴回数を更新
        await tx.video.update({
          where: { id: video.id },
          data: { viewCount: { increment: 1 } }
        })
        
        // ViewLogのフラグを更新
        await tx.viewLog.update({
          where: { id: currentViewLog.id },
          data: { viewCountUpdated: true }
        })
      })
      
      viewCountUpdated = true
      
      console.log(`視聴回数を更新: videoId=${video.id}, sessionId=${sessionId}, completionRate=${completionRate}%, watchDuration=${watchDuration}秒, 閾値=${thresholdPercent}%/${thresholdSeconds}秒`)
    }
    
    return NextResponse.json({
      success: true,
      data: {
        viewCountUpdated,
        currentViewCount: video.viewCount + (viewCountUpdated ? 1 : 0),
        watchDuration,
        completionRate,
        thresholds: {
          percent: thresholdPercent,
          seconds: thresholdSeconds,
          duplicateHours: duplicateHours
        }
      }
    })
    
  } catch (error) {
    console.error('視聴進捗更新エラー:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
} 