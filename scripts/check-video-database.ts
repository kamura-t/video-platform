import { prisma } from '../lib/prisma'

async function checkVideoDatabase() {
  console.log('データベースの動画テーブルを確認中...')
  
  // すべての動画を取得
  const videos = await prisma.video.findMany({
    select: {
      id: true,
      videoId: true,
      title: true,
      filePath: true,
      status: true,
      uploadType: true,
      createdAt: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  console.log(`動画数: ${videos.length}`)
  console.log('\n=== 動画一覧 ===')
  
  videos.forEach(video => {
    console.log(`- ID: ${video.id}, VideoID: ${video.videoId}`)
    console.log(`  タイトル: ${video.title}`)
    console.log(`  ファイルパス: ${video.filePath}`)
    console.log(`  ステータス: ${video.status}`)
    console.log(`  アップロードタイプ: ${video.uploadType}`)
    console.log(`  作成日: ${video.createdAt}`)
    console.log('')
  })

  // EWVve_8uIIW を特定で検索
  const specificVideo = await prisma.video.findUnique({
    where: {
      videoId: 'EWVve_8uIIW'
    }
  })

  if (specificVideo) {
    console.log('=== EWVve_8uIIW の詳細 ===')
    console.log(JSON.stringify(specificVideo, null, 2))
  } else {
    console.log('EWVve_8uIIW はデータベースに存在しません')
  }
}

// スクリプト実行
if (require.main === module) {
  checkVideoDatabase()
    .then(() => process.exit(0))
    .catch(console.error)
}

export { checkVideoDatabase } 