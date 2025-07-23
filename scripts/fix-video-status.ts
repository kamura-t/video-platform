import { prisma } from '../lib/prisma'

async function fixVideoStatus() {
  console.log('動画ステータスの修正を開始...')
  
  // EWVve_8uIIW の動画を取得
  const video = await prisma.video.findUnique({
    where: {
      videoId: 'EWVve_8uIIW'
    }
  })

  if (!video) {
    console.log('EWVve_8uIIW の動画が見つかりません')
    return
  }

  console.log('現在のステータス:', video.status)
  console.log('ファイルパス:', video.filePath)

  // ステータスを COMPLETED に変更
  await prisma.video.update({
    where: {
      videoId: 'EWVve_8uIIW'
    },
    data: {
      status: 'COMPLETED'
    }
  })

  console.log('ステータスを COMPLETED に変更しました')

  // 変更後の動画を確認
  const updatedVideo = await prisma.video.findUnique({
    where: {
      videoId: 'EWVve_8uIIW'
    }
  })

  console.log('更新後のステータス:', updatedVideo?.status)
}

// スクリプト実行
if (require.main === module) {
  fixVideoStatus()
    .then(() => process.exit(0))
    .catch(console.error)
}

export { fixVideoStatus } 