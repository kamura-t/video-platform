import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

// サムネイル画像の設定
export const THUMBNAIL_CONFIG = {
  width: 1280,  // 720pに変更
  height: 720,  // 720pに変更
  quality: 85,
  format: 'webp' as const,
  maxFileSize: 300 * 1024, // 300KB
};

// 一般的な画像の設定
export const IMAGE_CONFIG = {
  maxWidth: 1920,
  maxHeight: 1080,
  quality: 90,
  format: 'webp' as const,
  maxFileSize: 1024 * 1024, // 1MB
};

/**
 * 画像をリサイズしてWebP形式に変換
 */
export async function processImage(
  inputBuffer: Buffer,
  outputPath: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png';
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  } = {}
): Promise<{ 
  filePath: string; 
  fileSize: number; 
  width: number; 
  height: number;
  format: string;
}> {
  const {
    width = THUMBNAIL_CONFIG.width,
    height = THUMBNAIL_CONFIG.height,
    quality = THUMBNAIL_CONFIG.quality,
    format = THUMBNAIL_CONFIG.format,
    fit = 'cover'
  } = options;

  try {
    // 出力ディレクトリを作成
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Sharp で画像を処理
    const sharpInstance = sharp(inputBuffer);
    
    // メタデータを取得
    const metadata = await sharpInstance.metadata();
    console.log(`元画像: ${metadata.width}x${metadata.height}, ${metadata.format}, ${Math.round((inputBuffer.length / 1024))}KB`);

    // リサイズと変換
    let processedImage = sharpInstance
      .resize(width, height, { fit, withoutEnlargement: true });

    // フォーマットに応じて適切な変換を実行
    if (format === 'webp') {
      processedImage = processedImage.webp({ 
        quality,
        effort: 6, // 圧縮効率を高める（1-6、6が最高）
        lossless: false
      });
    } else if (format === 'jpeg') {
      processedImage = processedImage.jpeg({ quality });
    } else if (format === 'png') {
      processedImage = processedImage.png({ quality });
    }

    // ファイルに保存
    const outputInfo = await processedImage.toFile(outputPath);
    
    console.log(`処理後画像: ${outputInfo.width}x${outputInfo.height}, ${format}, ${Math.round((outputInfo.size / 1024))}KB`);

    return {
      filePath: outputPath,
      fileSize: outputInfo.size,
      width: outputInfo.width,
      height: outputInfo.height,
      format: format
    };

  } catch (error) {
    console.error('画像処理エラー:', error);
    throw new Error(`画像の処理に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
  }
}

/**
 * サムネイル画像専用の処理関数
 */
export async function processThumbnail(
  inputBuffer: Buffer,
  outputPath: string
): Promise<{ 
  filePath: string; 
  fileSize: number; 
  width: number; 
  height: number;
  format: string;
}> {
  return processImage(inputBuffer, outputPath, {
    width: THUMBNAIL_CONFIG.width,
    height: THUMBNAIL_CONFIG.height,
    quality: THUMBNAIL_CONFIG.quality,
    format: THUMBNAIL_CONFIG.format,
    fit: 'cover'
  });
}

/**
 * 画像ファイルのバリデーション
 */
export function validateImageFile(file: File): { isValid: boolean; error?: string } {
  // ファイルサイズチェック（10MB制限）
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `ファイルサイズが大きすぎます。最大${Math.round(maxSize / 1024 / 1024)}MBまでです。`
    };
  }

  // ファイル形式チェック
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: 'サポートされていない画像形式です。JPEG、PNG、WebP形式のファイルを選択してください。'
    };
  }

  return { isValid: true };
}

/**
 * ファイル名を生成（WebP拡張子付き）
 */
export function generateImageFileName(
  prefix: string,
  originalName?: string,
  format: string = 'webp'
): string {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  
  // 元のファイル名から拡張子を除去
  const baseName = originalName 
    ? path.parse(originalName).name.replace(/[^a-zA-Z0-9_-]/g, '_')
    : 'image';
  
  return `${prefix}_${baseName}_${timestamp}_${randomStr}.${format}`;
}

/**
 * 古い画像ファイルを削除
 */
export async function deleteImageFile(filePath: string): Promise<void> {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`画像ファイルを削除しました: ${filePath}`);
    }
  } catch (error) {
    console.error(`画像ファイル削除エラー: ${filePath}`, error);
  }
}

/**
 * 画像の圧縮率を計算
 */
export function calculateCompressionRatio(originalSize: number, compressedSize: number): number {
  return Math.round(((originalSize - compressedSize) / originalSize) * 100);
} 