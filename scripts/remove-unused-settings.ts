import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// コードベースで使われているキー一覧
const usedKeys = [
  'site_title', 'site_description', 'site_logo_icon', 'site_logo_image',
  'videos_per_page', 'new_badge_display_days', 'max_file_size_mb',
  'max_image_size_mb', 'allowed_file_types',
  'nfs_mounted', 'gpu_server_url', 'gpu_transcoding_enabled',
  'session_timeout', 'youtube_api_key', 'private_video_allowed_ips',
  'view_count_threshold_percent', 'view_count_threshold_seconds', 'view_duplicate_hours'
]

async function main() {
  const allSettings = await prisma.systemSetting.findMany()
  const unused = allSettings.filter(s => !usedKeys.includes(s.settingKey))
  if (unused.length === 0) {
    console.log('不要なキーはありません')
    return
  }
  console.log('削除するキー:', unused.map(u => u.settingKey))
  await prisma.systemSetting.deleteMany({
    where: { settingKey: { in: unused.map(u => u.settingKey) } }
  })
  console.log('削除完了')
}

main().finally(() => prisma.$disconnect()) 