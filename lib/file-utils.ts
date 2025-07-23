import fs from 'fs/promises';
import path from 'path';

/**
 * ファイルパスを実際のファイルシステムパスに変換
 * @param relativePath データベースに保存されている相対パス
 * @returns 実際のファイルシステムパス
 */
export function getActualFilePath(relativePath: string): string {
  if (!relativePath) return '';
  
  // NASマウントパスを環境変数から取得
  const nasMountPath = process.env.NAS_VIDEOS_PATH || '/Volumes/videos';
  
  // 相対パスから実際のファイルパスを構築
  if (relativePath.startsWith('/videos/')) {
    // /videos/ で始まるパスをNASマウントパスに変換
    const relativeToVideos = relativePath.replace('/videos/', '');
    return path.join(nasMountPath, relativeToVideos);
  }
  
  // その他の場合は従来通りpublicディレクトリを確認
  return path.join(process.cwd(), 'public', relativePath);
}

/**
 * ファイルを削除
 * @param filePath 削除するファイルパス
 * @returns 削除されたファイルパス
 */
export async function deleteFile(filePath: string): Promise<string> {
  if (!filePath) {
    return '';
  }

  try {
    // 実際のファイルパスを取得
    const actualFilePath = getActualFilePath(filePath);
    console.log(`削除対象ファイルパス: ${actualFilePath}`);

    // ファイルの存在確認
    await fs.access(actualFilePath);
    
    // ファイルを削除
    await fs.unlink(actualFilePath);
    console.log(`ファイルを削除しました: ${actualFilePath}`);
    
    return filePath;
  } catch (error) {
    console.log(`ファイルが見つかりません: ${filePath}`);
    return '';
  }
}

/**
 * 削除ログを記録
 * @param videoData 削除された動画データ
 * @param deletedFiles 削除されたファイルパスの配列
 * @param deletedBy 削除実行者のユーザーID
 */
export async function logFileDeletion(
  videoData: any,
  deletedFiles: string[],
  deletedBy: number
): Promise<void> {
  const logEntry = {
    deletedAt: new Date().toISOString(),
    videoId: videoData.videoId,
    title: videoData.title,
    originalFilePath: videoData.filePath,
    originalThumbnailPath: videoData.thumbnailUrl,
    convertedFilePath: videoData.convertedFilePath,
    deletedFiles,
    uploaderId: videoData.uploaderId,
    deletedBy,
    fileSize: videoData.fileSize?.toString() || '0',
    originalFilename: videoData.originalFilename,
    mimeType: videoData.mimeType
  };

  // ログファイルパス
  const today = new Date().toISOString().split('T')[0];
  const logDir = path.join(process.cwd(), 'delete', 'logs');
  await fs.mkdir(logDir, { recursive: true });
  
  const logFilePath = path.join(logDir, `${today}.json`);

  // 既存のログを読み込み
  let logs: any[] = [];
  try {
    const existingLogs = await fs.readFile(logFilePath, 'utf-8');
    logs = JSON.parse(existingLogs);
  } catch {
    // ファイルが存在しない場合は新規作成
  }

  // 新しいログエントリを追加
  logs.push(logEntry);

  // ログファイルに書き込み
  await fs.writeFile(logFilePath, JSON.stringify(logs, null, 2));
  console.log(`削除ログを記録しました: ${logFilePath}`);
} 