import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const THUMBNAILS_DIR = process.env.NAS_VIDEOS_PATH ? `${process.env.NAS_VIDEOS_PATH}/thumbnails` : '/Volumes/videos/thumbnails';

async function convertThumbnailsToWebP() {
  try {
    console.log('サムネイルをWebP形式に変換中...');
    
    // サムネイルディレクトリの存在確認
    if (!fs.existsSync(THUMBNAILS_DIR)) {
      console.error(`サムネイルディレクトリが見つかりません: ${THUMBNAILS_DIR}`);
      return;
    }
    
    // JPGファイルを検索
    const files = fs.readdirSync(THUMBNAILS_DIR);
    const jpgFiles = files.filter(file => 
      file.toLowerCase().endsWith('.jpg') || file.toLowerCase().endsWith('.jpeg')
    );
    
    console.log(`${jpgFiles.length}個のJPGファイルが見つかりました`);
    
    let convertedCount = 0;
    let errorCount = 0;
    
    for (const jpgFile of jpgFiles) {
      try {
        const jpgPath = path.join(THUMBNAILS_DIR, jpgFile);
        const webpFileName = jpgFile.replace(/\.(jpg|jpeg)$/i, '.webp');
        const webpPath = path.join(THUMBNAILS_DIR, webpFileName);
        
        // 既にWebPファイルが存在する場合はスキップ
        if (fs.existsSync(webpPath)) {
          console.log(`既にWebPファイルが存在します: ${webpFileName}`);
          continue;
        }
        
        // JPGをWebPに変換
        await sharp(jpgPath)
          .webp({ 
            quality: 85,
            effort: 6
          })
          .toFile(webpPath);
        
        // 元のJPGファイルを削除
        fs.unlinkSync(jpgPath);
        
        console.log(`変換完了: ${jpgFile} → ${webpFileName}`);
        convertedCount++;
        
      } catch (error) {
        console.error(`変換エラー (${jpgFile}):`, error);
        errorCount++;
      }
    }
    
    console.log(`\n変換完了:`);
    console.log(`- 成功: ${convertedCount}個`);
    console.log(`- エラー: ${errorCount}個`);
    
  } catch (error) {
    console.error('スクリプト実行エラー:', error);
  }
}

// スクリプト実行
convertThumbnailsToWebP(); 