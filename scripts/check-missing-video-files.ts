import { prisma } from '../lib/prisma'
import fs from 'fs'
import path from 'path'

async function checkMissingVideoFiles() {
  console.log('動画ファイルの存在確認を開始...')
  
  // ファイルアップロード方式の動画をすべて取得
  const videos = await prisma.video.findMany({
    where: {
      uploadType: 'FILE',
      filePath: {
        not: null
      }
    },
    select: {
      videoId: true,
      title: true,
      filePath: true,
      status: true
    }
  })

  console.log(`チェック対象動画数: ${videos.length}`)

  const missingFiles: any[] = []
  const existingFiles: any[] = []

  for (const video of videos) {
    if (!video.filePath) continue

    const fullPath = path.join(process.cwd(), 'public', video.filePath)
    
    if (fs.existsSync(fullPath)) {
      existingFiles.push(video)
      console.log(`✓ 存在: ${video.videoId} - ${video.title}`)
    } else {
      missingFiles.push(video)
      console.log(`✗ 不存在: ${video.videoId} - ${video.title} (${video.filePath})`)
    }
  }

  console.log(`\n=== チェック結果 ===`)
  console.log(`存在するファイル: ${existingFiles.length}`)
  console.log(`存在しないファイル: ${missingFiles.length}`)

  if (missingFiles.length > 0) {
    console.log('\n=== 存在しないファイル一覧 ===')
    missingFiles.forEach(video => {
      console.log(`- ${video.videoId}: ${video.title}`)
      console.log(`  パス: ${video.filePath}`)
    })

    // 修正オプションを提示
    console.log('\n=== 修正オプション ===')
    console.log('1. これらの動画のステータスを "FAILED" に変更する')
    console.log('2. これらの動画を削除する')
    console.log('3. 手動で修正する')
  }

  return { existingFiles, missingFiles }
}

async function fixMissingVideoFiles(action: 'mark' | 'delete') {
  const videos = await prisma.video.findMany({
    where: {
      uploadType: 'FILE',
      filePath: {
        not: null
      }
    }
  })

  const missingFiles: string[] = []

  for (const video of videos) {
    if (!video.filePath) continue

    const fullPath = path.join(process.cwd(), 'public', video.filePath)
    
    if (!fs.existsSync(fullPath)) {
      missingFiles.push(video.videoId)
    }
  }

  if (missingFiles.length === 0) {
    console.log('存在しないファイルはありません。')
    return
  }

  if (action === 'mark') {
    // ステータスを FAILED に変更
    await prisma.video.updateMany({
      where: {
        videoId: {
          in: missingFiles
        }
      },
      data: {
        status: 'FAILED'
      }
    })
    console.log(`${missingFiles.length} 個の動画のステータスを FAILED に変更しました。`)
  } else if (action === 'delete') {
    // 動画を削除
    await prisma.video.deleteMany({
      where: {
        videoId: {
          in: missingFiles
        }
      }
    })
    console.log(`${missingFiles.length} 個の動画を削除しました。`)
  }
}

// スクリプト実行
if (require.main === module) {
  const action = process.argv[2]
  
  if (action === 'check') {
    checkMissingVideoFiles()
      .then(() => process.exit(0))
      .catch(console.error)
  } else if (action === 'fix-mark') {
    fixMissingVideoFiles('mark')
      .then(() => process.exit(0))
      .catch(console.error)
  } else if (action === 'fix-delete') {
    fixMissingVideoFiles('delete')
      .then(() => process.exit(0))
      .catch(console.error)
  } else {
    console.log('使用方法:')
    console.log('  npm run script check-missing-video-files check')
    console.log('  npm run script check-missing-video-files fix-mark')
    console.log('  npm run script check-missing-video-files fix-delete')
  }
}

export { checkMissingVideoFiles, fixMissingVideoFiles } 