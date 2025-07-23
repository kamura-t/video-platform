import { NextRequest, NextResponse } from 'next/server'

// YouTube Data APIを使用してメタデータを取得
async function fetchYouTubeMetadata(videoId: string) {
  // データベースから設定を取得
  let YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY
  
  try {
    const { prisma } = await import('@/lib/prisma')
    const setting = await prisma.systemSetting.findUnique({
      where: { settingKey: 'youtube_api_key' }
    })
    
    if (setting?.settingValue) {
      YOUTUBE_API_KEY = setting.settingValue
    }
  } catch (error) {
    console.error('Failed to fetch YouTube API key from database:', error)
  }
  
  if (!YOUTUBE_API_KEY) {
    // APIキーが設定されていない場合は、oEmbedを使用して基本情報を取得
    try {
      const oEmbedResponse = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
      )
      
      if (oEmbedResponse.ok) {
        const oEmbedData = await oEmbedResponse.json()
        return {
          title: oEmbedData.title || `YouTube Video ${videoId}`,
          description: oEmbedData.title ? `${oEmbedData.title} - ${oEmbedData.author_name}によるYouTube動画` : `${oEmbedData.author_name}によるYouTube動画`,
          thumbnail: oEmbedData.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          duration: 0,
          channelTitle: oEmbedData.author_name || 'YouTube',
          tags: [] // oEmbedではタグ情報が取得できないため空配列
        }
      }
    } catch (error) {
      console.error('oEmbed API Error:', error)
    }
    
    // oEmbedも失敗した場合は基本情報を返す
    return {
      title: `YouTube Video ${videoId}`,
      description: 'YouTube動画から取得',
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      duration: 0,
      channelTitle: 'YouTube',
      tags: []
    }
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${YOUTUBE_API_KEY}&part=snippet,contentDetails,statistics`
    )
    
    if (!response.ok) {
      throw new Error('YouTube API request failed')
    }
    
    const data = await response.json()
    
    if (!data.items || data.items.length === 0) {
      throw new Error('Video not found')
    }
    
    const video = data.items[0]
    const snippet = video.snippet
    const contentDetails = video.contentDetails
    
    // ISO 8601 duration (PT4M13S) を秒に変換
    const duration = parseDuration(contentDetails.duration)
    
    return {
      title: snippet.title,
      description: snippet.description,
      thumbnail: snippet.thumbnails.maxres?.url || snippet.thumbnails.high?.url || snippet.thumbnails.medium?.url,
      duration,
      channelTitle: snippet.channelTitle,
      publishedAt: snippet.publishedAt,
      tags: snippet.tags || []
    }
  } catch (error) {
    console.error('YouTube API Error:', error)
    // エラーの場合は基本情報を返す
    return {
      title: `YouTube Video ${videoId}`,
      description: 'YouTube動画から取得',
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      duration: 0,
      channelTitle: 'YouTube'
    }
  }
}

// ISO 8601 duration を秒に変換する関数
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  
  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const seconds = parseInt(match[3] || '0', 10)
  
  return hours * 3600 + minutes * 60 + seconds
}

export async function POST(request: NextRequest) {
  try {
    const { youtubeUrl } = await request.json()
    
    if (!youtubeUrl) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'YouTube URLが必要です' 
        },
        { status: 400 }
      )
    }
    
    // YouTube URLから動画IDを抽出
    const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/
    const match = youtubeUrl.match(youtubeRegex)
    
    if (!match) {
      return NextResponse.json(
        { 
          success: false, 
          error: '有効なYouTube URLを入力してください' 
        },
        { status: 400 }
      )
    }
    
    const videoId = match[1]
    const metadata = await fetchYouTubeMetadata(videoId)
    
    return NextResponse.json({
      success: true,
      data: {
        videoId,
        ...metadata
      }
    })
    
  } catch (error) {
    console.error('YouTube Metadata API Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'メタデータの取得に失敗しました' 
      },
      { status: 500 }
    )
  }
} 