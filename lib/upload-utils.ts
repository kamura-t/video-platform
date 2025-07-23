import { prisma } from './prisma';

// ファイルタイプ設定
export const ACCEPTED_VIDEO_TYPES = {
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
  'video/x-msvideo': ['.avi'],
  'video/webm': ['.webm'],
  'video/x-ms-wmv': ['.wmv'],
  'video/x-matroska': ['.mkv'],
} as const;

export const ACCEPTED_IMAGE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
} as const;

// MIMEタイプ補正マップ
export const MIME_TYPE_CORRECTIONS: { [key: string]: string } = {
  'mov': 'video/quicktime',
  'mp4': 'video/mp4',
  'avi': 'video/x-msvideo',
  'webm': 'video/webm',
  'wmv': 'video/x-ms-wmv',
  'mkv': 'video/x-matroska'
};

// ファイルサイズ設定
export const DEFAULT_MAX_VIDEO_SIZE = 5 * 1024 * 1024 * 1024; // 5GB
export const DEFAULT_MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

// バリデーション結果の型
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

// システム設定を取得するキャッシュ機能付きヘルパー
let settingsCache: { [key: string]: string } = {};
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5分

export async function getSystemSettings(): Promise<{ [key: string]: string }> {
  const now = Date.now();
  
  if (now - cacheTimestamp > CACHE_DURATION) {
    try {
      const settings = await prisma.systemSetting.findMany({
        where: {
          settingKey: {
            in: ['max_file_size_mb', 'allowed_file_types', 'max_image_size_mb']
          }
        }
      });
      
      settingsCache = settings.reduce((acc, setting) => {
        acc[setting.settingKey] = setting.settingValue || '';
        return acc;
      }, {} as { [key: string]: string });
      
      cacheTimestamp = now;
    } catch (error) {
      console.error('Failed to fetch system settings:', error);
    }
  }
  
  return settingsCache;
}

// MIMEタイプを補正する共通関数
export function correctMimeType(file: File): File {
  if (file.type !== 'application/octet-stream') {
    return file;
  }

  const fileExtension = file.name.toLowerCase().split('.').pop();
  if (!fileExtension || !MIME_TYPE_CORRECTIONS[fileExtension]) {
    return file;
  }

  const correctedMimeType = MIME_TYPE_CORRECTIONS[fileExtension];
  console.log('🔧 MIMEタイプを補正:', { 
    original: file.type, 
    corrected: correctedMimeType, 
    extension: fileExtension 
  });

  return new File([file], file.name, { type: correctedMimeType });
}

// 動画ファイルのバリデーション（統合版）
export async function validateVideoFile(file: File): Promise<ValidationResult> {
  const settings = await getSystemSettings();
  const maxSizeMB = parseInt(settings.max_file_size_mb || '5120');
  const maxSize = maxSizeMB * 1024 * 1024;
  
  // ファイルサイズチェック
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `ファイルサイズが制限を超えています（最大${Math.floor(maxSizeMB / 1024)}GB）`
    };
  }
  
  // MIMEタイプを補正
  const correctedFile = correctMimeType(file);
  
  // ファイル形式チェック
  const allowedTypes = Object.keys(ACCEPTED_VIDEO_TYPES);
  if (!allowedTypes.includes(correctedFile.type)) {
    return {
      isValid: false,
      error: 'サポートされていないファイル形式です。MP4、MOV、AVI、WebM、WMV、MKV形式のファイルを選択してください。'
    };
  }
  
  return { isValid: true };
}

// 画像ファイルのバリデーション
export async function validateImageFile(file: File): Promise<ValidationResult> {
  const settings = await getSystemSettings();
  const maxSizeMB = parseInt(settings.max_image_size_mb || '2');
  const maxSize = maxSizeMB * 1024 * 1024;
  
  // ファイルサイズチェック
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `画像ファイルサイズが${maxSizeMB}MBを超えています。`
    };
  }
  
  // ファイル形式チェック
  const allowedTypes = Object.keys(ACCEPTED_IMAGE_TYPES);
  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: 'サポートされていない画像形式です。JPEG、PNG、WebP、GIF形式のファイルを選択してください。'
    };
  }
  
  return { isValid: true };
}

// ファイルサイズを読みやすい形式に変換
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 圧縮率を計算
export function calculateCompressionRatio(originalSize: number, compressedSize: number): number {
  if (originalSize === 0) return 0;
  return Math.round(((originalSize - compressedSize) / originalSize) * 100);
}

// ファイル名を生成（重複を避けるため）
export function generateUniqueFileName(originalName: string, prefix?: string): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  
  // 拡張子を安全に取得
  const lastDotIndex = originalName.lastIndexOf('.');
  const extension = lastDotIndex > 0 ? originalName.substring(lastDotIndex + 1) : '';
  const baseName = lastDotIndex > 0 ? originalName.substring(0, lastDotIndex) : originalName;
  
  // ベース名を安全に処理（特殊文字を置換）
  const safeBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '_');
  
  // 拡張子がある場合は追加、ない場合は空文字
  const extensionPart = extension ? `.${extension}` : '';
  
  return prefix 
    ? `${prefix}_${timestamp}_${randomSuffix}_${safeBaseName}${extensionPart}`
    : `${timestamp}_${randomSuffix}_${safeBaseName}${extensionPart}`;
}

// MIMEタイプから拡張子を取得
export function getExtensionFromMimeType(mimeType: string): string {
  const videoExtensions = {
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'video/webm': 'webm',
    'video/x-ms-wmv': 'wmv',
    'video/x-matroska': 'mkv',
  };
  
  const imageExtensions = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  
  return videoExtensions[mimeType as keyof typeof videoExtensions] || 
         imageExtensions[mimeType as keyof typeof imageExtensions] || 
         'bin';
}

// 動画ファイルかどうかを判定
export function isVideoFile(file: File): boolean {
  const correctedFile = correctMimeType(file);
  return Object.keys(ACCEPTED_VIDEO_TYPES).includes(correctedFile.type);
}

// 画像ファイルかどうかを判定
export function isImageFile(file: File): boolean {
  return Object.keys(ACCEPTED_IMAGE_TYPES).includes(file.type);
}

// ファイルアップロード用の共通設定を取得
export async function getUploadConfig() {
  const settings = await getSystemSettings();
  
  return {
    maxVideoSizeMB: parseInt(settings.max_file_size_mb || '5120'),
    maxImageSizeMB: parseInt(settings.max_image_size_mb || '2'),
    maxVideoSize: parseInt(settings.max_file_size_mb || '5120') * 1024 * 1024,
    maxImageSize: parseInt(settings.max_image_size_mb || '2') * 1024 * 1024,
    acceptedVideoTypes: ACCEPTED_VIDEO_TYPES,
    acceptedImageTypes: ACCEPTED_IMAGE_TYPES,
  };
}

// YouTube URL関連の共通関数
export const extractYouTubeVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
};

export const validateYouTubeUrl = (url: string): string | null => {
  const videoId = extractYouTubeVideoId(url);
  return videoId ? null : '有効なYouTube URLを入力してください';
};

// サムネイル生成の共通関数
export const generateThumbnailFromVideo = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    video.onloadedmetadata = () => {
      video.currentTime = 5; // 5秒目でサムネイル生成
    };
    
    video.onseeked = () => {
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      }
    };
    
    video.onerror = () => {
      reject(new Error('動画の読み込みに失敗しました'));
    };
    
    video.src = URL.createObjectURL(file);
  });
};