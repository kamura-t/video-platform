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


  // カテゴリの作成
  const categories = [
    { name: 'プレゼンテーション', slug: 'presentation', description: 'プレゼンテーション・発表動画', color: '#F59E0B' },
    { name: '講義', slug: 'lecture', description: '授業関係・講義記録映像', color: '#EF4444' },
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
      settingValue: '藝大画楽',
      settingType: 'STRING' as const,
      description: 'サイトのタイトル',
      isActive: true,
    },
    {
      settingKey: 'site_description',
      settingValue: '動画視聴プラットフォーム',
      settingType: 'TEXT' as const,
      description: 'サイトの説明',
      isActive: true,
    },
    {
      settingKey: 'max_file_size_mb',
      settingValue: '10240', // 10GB
      settingType: 'INTEGER' as const,
      description: '最大アップロードファイルサイズ（MB）',
      isActive: true,
    },
    {
      settingKey: 'max_image_size_mb',
      settingValue: '1',
      settingType: 'INTEGER' as const,
      description: '最大画像サイズ（MB）',
      isActive: true,
    },

    {
      settingKey: 'allowed_file_types',
      settingValue: 'mp4,mov,avi,mkv,wmv',
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
      settingKey: 'videos_per_page',
      settingValue: '20',
      settingType: 'INTEGER' as const,
      description: '1ページあたりの動画表示数',
      isActive: true,
    },
    {
      settingKey: 'new_badge_display_days',
      settingValue: '10',
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
      settingValue: '300',
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
    {
      settingKey: 'thumbnail_format',
      settingValue: 'jpg',
      settingType: 'STRING' as const,
      description: 'サムネイル生成形式（jpg または webp）',
      isActive: true,
    },
    {
      settingKey: 'thumbnail_quality',
      settingValue: '95',
      settingType: 'INTEGER' as const,
      description: 'サムネイル生成品質（1-100）',
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


  console.log('Database seed completed')
  console.log(`👤 管理者ユーザー: ${admin.username} (${admin.email})`)
  console.log(`📂 カテゴリ数: ${categories.length}`)
  console.log(`🏷️ タグ数: ${tags.length}`)
  console.log(`⚙️ システム設定数: ${systemSettings.length}`)
}


main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 