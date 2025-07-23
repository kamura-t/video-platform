import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { configService } from './config-service'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting database seed...')

  // 設定サービスの初期化
  if (configService) {
    console.log('Setting up default settings...')
    await configService.setupDefaultSettings()
    console.log('Default settings setup completed')
  }

  // 管理者ユーザーの作成
  const adminPassword = await bcrypt.hash('admin123456', 10)
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      displayName: 'システム管理者',
      email: 'admin@example.com',
      passwordHash: adminPassword,
      role: 'ADMIN',
      department: 'システム管理部',
    },
  })

  // 投稿者ユーザーの作成
  const curatorPassword = await bcrypt.hash('curator123456', 10)
  const curator = await prisma.user.upsert({
    where: { username: 'curator' },
    update: {},
    create: {
      username: 'curator',
      displayName: '動画投稿者',
      email: 'curator@example.com',
      passwordHash: curatorPassword,
      role: 'CURATOR',
      department: '動画制作部',
    },
  })

  // カテゴリの作成
  const categories = [
    { name: 'プログラミング', slug: 'programming', description: 'プログラミング関連の動画', color: '#3B82F6' },
    { name: '研修', slug: 'training', description: '社内研修・教育動画', color: '#10B981' },
    { name: 'プレゼンテーション', slug: 'presentation', description: 'プレゼンテーション・発表動画', color: '#F59E0B' },
    { name: 'ドキュメンタリー', slug: 'documentary', description: 'ドキュメンタリー・記録動画', color: '#EF4444' },
    { name: 'その他', slug: 'others', description: 'その他の動画', color: '#6B7280' },
  ]

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: category,
    })
  }

  // タグの作成
  const tags = [
    { name: 'JavaScript' },
    { name: 'React' },
    { name: 'TypeScript' },
    { name: 'Next.js' },
    { name: '初心者向け' },
    { name: '上級者向け' },
    { name: 'フレームワーク' },
    { name: 'チュートリアル' },
  ]

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: { name: tag.name },
      update: {},
      create: { name: tag.name },
    })
  }

  // システム設定の作成
  const systemSettings = [
    {
      settingKey: 'site_title',
      settingValue: '組織向け動画プラットフォーム',
      settingType: 'STRING' as const,
      description: 'サイトのタイトル',
      isActive: true,
    },
    {
      settingKey: 'site_description',
      settingValue: '組織内での動画コンテンツの効率的な管理・共有を可能にする専用プラットフォーム',
      settingType: 'TEXT' as const,
      description: 'サイトの説明',
      isActive: true,
    },
    {
      settingKey: 'max_file_size_mb',
      settingValue: '5120', // 5GB
      settingType: 'INTEGER' as const,
      description: '最大アップロードファイルサイズ（MB）',
      isActive: true,
    },
    {
      settingKey: 'max_image_size_mb',
      settingValue: '2',
      settingType: 'INTEGER' as const,
      description: '最大画像サイズ（MB）',
      isActive: true,
    },

    {
      settingKey: 'allowed_file_types',
      settingValue: 'mp4,mov,avi,mkv,wmv,flv,webm',
      settingType: 'STRING' as const,
      description: '許可するファイル形式（カンマ区切り）',
      isActive: true,
    },
    {
      settingKey: 'nas_mount_path',
      settingValue: '/uploads/videos',
      settingType: 'FILE_PATH' as const,
      description: '動画保存パス',
      isActive: true,
    },
    {
      settingKey: 'nfs_mounted',
      settingValue: 'false',
      settingType: 'BOOLEAN' as const,
      description: 'NFSマウント状態',
      isActive: true,
    },
    {
      settingKey: 'gpu_server_url',
      settingValue: 'http://172.16.1.172:3001',
      settingType: 'STRING' as const,
      description: 'GPU変換サーバーURL',
      isActive: true,
    },
    {
      settingKey: 'gpu_transcoding_enabled',
      settingValue: 'true',
      settingType: 'BOOLEAN' as const,
      description: 'GPU変換機能有効化',
      isActive: true,
    },
    {
      settingKey: 'private_video_allowed_ips',
      settingValue: '["192.168.1.0/24", "172.16.0.0/12", "10.0.0.0/8", "127.0.0.1/32"]',
      settingType: 'JSON' as const,
      description: 'プライベート動画アクセス許可IPレンジ（組織内LAN）',
      isActive: true,
    },
    {
      settingKey: 'videos_per_page',
      settingValue: '20',
      settingType: 'INTEGER' as const,
      description: '1ページあたりの動画表示数',
      isActive: true,
    },
    {
      settingKey: 'new_badge_display_days',
      settingValue: '7',
      settingType: 'INTEGER' as const,
      description: '新着バッジ表示日数',
      isActive: true,
    },
    {
      settingKey: 'view_count_threshold_percent',
      settingValue: '30',
      settingType: 'INTEGER' as const,
      description: '視聴回数カウント閾値（%）',
      isActive: true,
    },
    {
      settingKey: 'view_count_threshold_seconds',
      settingValue: '180',
      settingType: 'INTEGER' as const,
      description: '視聴回数カウント閾値（秒）',
      isActive: true,
    },
    {
      settingKey: 'view_duplicate_hours',
      settingValue: '24',
      settingType: 'INTEGER' as const,
      description: '重複視聴制御時間（時間）',
      isActive: true,
    },
    {
      settingKey: 'view_history_retention_days',
      settingValue: '1825', // 5年間（365日 × 5年）
      settingType: 'INTEGER' as const,
      description: '視聴履歴保持期間（日数）- 大学利用: 在学期間4年+1年',
      isActive: true,
    },
    {
      settingKey: 'view_history_cleanup_enabled',
      settingValue: 'true',
      settingType: 'BOOLEAN' as const,
      description: '視聴履歴自動クリーンアップ機能',
      isActive: true,
    },
    {
      settingKey: 'view_history_cleanup_batch_size',
      settingValue: '1000',
      settingType: 'INTEGER' as const,
      description: '視聴履歴クリーンアップ一回あたりの処理件数',
      isActive: true,
    },
  ]

  for (const setting of systemSettings) {
    await prisma.systemSetting.upsert({
      where: { settingKey: setting.settingKey },
      update: {},
      create: setting,
    })
  }

  // 動画とポストのシード処理
  await seedVideosAndPosts(curator.id)

  console.log('Database seed completed')
  console.log(`👤 管理者ユーザー: ${admin.username} (${admin.email})`)
  console.log(`👤 投稿者ユーザー: ${curator.username} (${curator.email})`)
  console.log(`📂 カテゴリ数: ${categories.length}`)
  console.log(`🏷️ タグ数: ${tags.length}`)
  console.log(`⚙️ システム設定数: ${systemSettings.length}`)
}

async function seedVideosAndPosts(curatorId: number) {
  console.log('🎥 動画とポストのシード処理を開始します...')

  // Create sample videos
  const videos = [
    {
      videoId: 'dQw4w9WgXcQ',
      title: 'React入門 - 基本概念の理解',
      description: 'Reactの基本概念について学習します。コンポーネント、state、propsなどの重要な概念を実例を交えて解説します。',
      uploadType: 'YOUTUBE' as const,
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      duration: 1800,
      status: 'COMPLETED' as const,
      visibility: 'PUBLIC' as const,
      viewCount: 1250,
      uploaderId: curatorId,
      publishedAt: new Date('2024-01-15'),
    },
    {
      videoId: 'abc123def45',
      title: 'TypeScript基礎講座',
      description: 'TypeScriptの基本的な型システムについて学習します。型注釈、インターフェース、ジェネリクスなどを実践的に学びます。',
      uploadType: 'YOUTUBE' as const,
      youtubeUrl: 'https://www.youtube.com/watch?v=abc123def45',
      thumbnailUrl: 'https://img.youtube.com/vi/abc123def45/maxresdefault.jpg',
      duration: 2400,
      status: 'COMPLETED' as const,
      visibility: 'PUBLIC' as const,
      viewCount: 890,
      uploaderId: curatorId,
      publishedAt: new Date('2024-01-20'),
    },
    {
      videoId: 'xyz789ghi12',
      title: 'Next.js入門 - App Routerの使い方',
      description: 'Next.js 14のApp Routerについて詳しく解説します。ルーティング、レイアウト、データフェッチングなどを学習します。',
      uploadType: 'YOUTUBE' as const,
      youtubeUrl: 'https://www.youtube.com/watch?v=xyz789ghi12',
      thumbnailUrl: 'https://img.youtube.com/vi/xyz789ghi12/maxresdefault.jpg',
      duration: 3200,
      status: 'COMPLETED' as const,
      visibility: 'PUBLIC' as const,
      viewCount: 2100,
      uploaderId: curatorId,
      publishedAt: new Date('2024-01-25'),
    },
  ]

  const createdVideos = []
  for (const video of videos) {
    const createdVideo = await prisma.video.create({
      data: video,
    })
    createdVideos.push(createdVideo)
  }

  // Create posts for videos
  const posts = [
    {
      postId: 'dQw4w9WgXcQ',
      postType: 'VIDEO' as const,
      title: 'React入門 - 基本概念の理解',
      description: 'Reactの基本概念について学習します。',
      visibility: 'PUBLIC' as const,
      videoId: createdVideos[0].id,
      creatorId: curatorId,
    },
    {
      postId: 'abc123def45',
      postType: 'VIDEO' as const,
      title: 'TypeScript基礎講座',
      description: 'TypeScriptの基本的な型システムについて学習します。',
      visibility: 'PUBLIC' as const,
      videoId: createdVideos[1].id,
      creatorId: curatorId,
    },
    {
      postId: 'xyz789ghi12',
      postType: 'VIDEO' as const,
      title: 'Next.js入門 - App Routerの使い方',
      description: 'Next.js 14のApp Routerについて詳しく解説します。',
      visibility: 'PUBLIC' as const,
      videoId: createdVideos[2].id,
      creatorId: curatorId,
    },
  ]

  for (const post of posts) {
    await prisma.post.create({
      data: post,
    })
  }

  // Create video categories
  const videoCategories = [
    { videoId: createdVideos[0].id, categoryId: 1 }, // React -> Programming
    { videoId: createdVideos[1].id, categoryId: 1 }, // TypeScript -> Programming
    { videoId: createdVideos[2].id, categoryId: 1 }, // Next.js -> Programming
  ]

  for (const vc of videoCategories) {
    await prisma.videoCategory.create({
      data: vc,
    })
  }

  // Create video tags
  const videoTags = [
    { videoId: createdVideos[0].id, tagId: 2 }, // React
    { videoId: createdVideos[0].id, tagId: 5 }, // 初心者向け
    { videoId: createdVideos[1].id, tagId: 3 }, // TypeScript
    { videoId: createdVideos[1].id, tagId: 5 }, // 初心者向け
    { videoId: createdVideos[2].id, tagId: 4 }, // Next.js
    { videoId: createdVideos[2].id, tagId: 7 }, // フレームワーク
  ]

  for (const vt of videoTags) {
    await prisma.videoTag.create({
      data: vt,
    })
  }

  console.log('🎥 動画とポストのシード処理が完了しました')
  console.log(`📹 動画数: ${createdVideos.length}`)
  console.log(`📝 ポスト数: ${posts.length}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 