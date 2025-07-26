import { ACCEPTED_VIDEO_TYPES, ACCEPTED_IMAGE_TYPES, correctMimeType } from './upload-utils';

// サーバーサイドチェック
const isServer = typeof window === 'undefined';

// バリデーション結果
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

// ファイル情報
export interface FileInfo {
  name: string;
  size: number;
  type: string;
  lastModified?: number;
}

// バリデーションルール
export interface ValidationRule {
  name: string;
  validate: (file: FileInfo, config?: any) => Promise<ValidationResult> | ValidationResult;
  severity: 'error' | 'warning';
}

// バリデーションサービス
export class ValidationService {
  private static instance: ValidationService;
  private videoRules: ValidationRule[] = [];
  private imageRules: ValidationRule[] = [];

  private constructor() {
    this.initializeRules();
  }

  public static getInstance(): ValidationService {
    if (!ValidationService.instance) {
      ValidationService.instance = new ValidationService();
    }
    return ValidationService.instance;
  }

  // 設定を取得（クライアントサイド対応）
  private async getConfig(): Promise<any> {
    if (isServer) {
      // サーバーサイドではConfigServiceを使用
      const { configService } = await import('./config-service');
      if (configService) {
        return await configService.getUploadConfig();
      }
    } else {
      // クライアントサイドではAPIを使用
      try {
        const response = await fetch('/api/settings/public');
        if (response.ok) {
          const result = await response.json();
          const data = result.data || result; // createSuccessResponseの構造に対応
          console.log('📊 設定API応答:', result);
          console.log('📊 設定データ:', data);
          console.log('📊 max_image_size_mb値:', data.max_image_size_mb);
          
          const config = {
            maxFileSizeMB: parseInt(data.max_file_size_mb || '5120'),
            maxImageSizeMB: parseInt(data.max_image_size_mb || '10'),
            allowedFileTypes: data.allowed_file_types || 'mp4,mov,avi,mkv,wmv,flv,webm'
          };
          console.log('📊 処理された設定:', config);
          return config;
        }
      } catch (error) {
        console.error('Failed to fetch config:', error);
      }
      
      // デフォルト設定
      return {
        maxFileSizeMB: 5120,
        maxImageSizeMB: 10,
        allowedFileTypes: 'mp4,mov,avi,mkv,wmv,flv,webm'
      };
    }
    
    // デフォルト設定（サーバーサイドでconfigServiceがnullの場合）
    return {
      maxFileSizeMB: 5120,
      maxImageSizeMB: 10,
      allowedFileTypes: 'mp4,mov,avi,mkv,wmv,flv,webm'
    };
  }

  // バリデーションルールの初期化
  private initializeRules(): void {
    // 動画ファイルのルール
    this.videoRules = [
      {
        name: 'fileType',
        severity: 'error',
        validate: (file: FileInfo) => {
          const allowedTypes = Object.keys(ACCEPTED_VIDEO_TYPES);
          console.log('🔍 ファイルタイプバリデーション:', {
            fileType: file.type,
            allowedTypes: allowedTypes,
            isAllowed: allowedTypes.includes(file.type)
          });
          
          if (!allowedTypes.includes(file.type)) {
            return {
              isValid: false,
              error: 'サポートされていないファイル形式です。MP4、MOV、AVI、WebM、WMV、FLV、MKV形式のファイルを選択してください。'
            };
          }
          return { isValid: true };
        }
      },
      {
        name: 'fileSize',
        severity: 'error',
        validate: async (file: FileInfo) => {
          const config = await this.getConfig();
          const maxSize = config.maxFileSizeMB * 1024 * 1024;
          
          if (file.size > maxSize) {
            return {
              isValid: false,
              error: `ファイルサイズが制限を超えています（最大${Math.floor(config.maxFileSizeMB / 1024)}GB）`
            };
          }
          return { isValid: true };
        }
      },
      {
        name: 'fileName',
        severity: 'warning',
        validate: (file: FileInfo) => {
          const warnings: string[] = [];
          
          // ファイル名の長さチェック
          if (file.name.length > 255) {
            warnings.push('ファイル名が長すぎます（255文字以下推奨）');
          }
          
          // 特殊文字チェック
          const hasSpecialChars = /[<>:"/\\|?*]/.test(file.name);
          if (hasSpecialChars) {
            warnings.push('ファイル名に特殊文字が含まれています');
          }
          
          // 日本語文字チェック
          const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(file.name);
          if (hasJapanese) {
            warnings.push('ファイル名に日本語が含まれています（英数字推奨）');
          }
          
          return {
            isValid: true,
            warnings: warnings.length > 0 ? warnings : undefined
          };
        }
      }
    ];

    // 画像ファイルのルール
    this.imageRules = [
      {
        name: 'fileType',
        severity: 'error',
        validate: (file: FileInfo) => {
          const allowedTypes = Object.keys(ACCEPTED_IMAGE_TYPES);
          if (!allowedTypes.includes(file.type)) {
            return {
              isValid: false,
              error: 'サポートされていない画像形式です。JPEG、PNG、WebP、GIF形式のファイルを選択してください。'
            };
          }
          return { isValid: true };
        }
      },
      {
        name: 'fileSize',
        severity: 'error',
        validate: async (file: FileInfo) => {
          const config = await this.getConfig();
          const maxSize = config.maxImageSizeMB * 1024 * 1024;
          
          if (file.size > maxSize) {
            return {
              isValid: false,
              error: `画像ファイルサイズが${config.maxImageSizeMB}MBを超えています。`
            };
          }
          return { isValid: true };
        }
      },
      {
        name: 'fileName',
        severity: 'warning',
        validate: (file: FileInfo) => {
          const warnings: string[] = [];
          
          if (file.name.length > 255) {
            warnings.push('ファイル名が長すぎます（255文字以下推奨）');
          }
          
          const hasSpecialChars = /[<>:"/\\|?*]/.test(file.name);
          if (hasSpecialChars) {
            warnings.push('ファイル名に特殊文字が含まれています');
          }
          
          return {
            isValid: true,
            warnings: warnings.length > 0 ? warnings : undefined
          };
        }
      }
    ];
  }

  // ファイル情報を抽出
  private extractFileInfo(file: File): FileInfo {
    return {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    };
  }

  // ルールを実行
  private async executeRules(rules: ValidationRule[], fileInfo: FileInfo): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const rule of rules) {
      try {
        const result = await rule.validate(fileInfo);
        
        if (!result.isValid && result.error) {
          if (rule.severity === 'error') {
            errors.push(result.error);
          } else {
            warnings.push(result.error);
          }
        }
        
        if (result.warnings) {
          warnings.push(...result.warnings);
        }
      } catch (error) {
        console.error(`Validation rule '${rule.name}' failed:`, error);
        if (rule.severity === 'error') {
          errors.push(`バリデーションエラー: ${rule.name}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      error: errors.length > 0 ? errors[0] : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  // 動画ファイルのバリデーション
  async validateVideoFile(file: File): Promise<ValidationResult> {
    const correctedFile = correctMimeType(file);
    const fileInfo = this.extractFileInfo(correctedFile);
    return this.executeRules(this.videoRules, fileInfo);
  }

  // 画像ファイルのバリデーション
  async validateImageFile(file: File): Promise<ValidationResult> {
    const fileInfo = this.extractFileInfo(file);
    return this.executeRules(this.imageRules, fileInfo);
  }

  // 一般的なファイルバリデーション
  async validateFile(file: File, type: 'video' | 'image'): Promise<ValidationResult> {
    if (type === 'video') {
      return this.validateVideoFile(file);
    } else {
      return this.validateImageFile(file);
    }
  }

  // 複数ファイルのバリデーション
  async validateMultipleFiles(files: File[], type: 'video' | 'image'): Promise<ValidationResult[]> {
    const results = await Promise.all(
      files.map(file => this.validateFile(file, type))
    );
    return results;
  }

  // ルールの追加
  addVideoRule(rule: ValidationRule): void {
    this.videoRules.push(rule);
  }

  addImageRule(rule: ValidationRule): void {
    this.imageRules.push(rule);
  }

  // ルールの削除
  removeRule(ruleName: string, type: 'video' | 'image'): void {
    const rules = type === 'video' ? this.videoRules : this.imageRules;
    const index = rules.findIndex(rule => rule.name === ruleName);
    if (index !== -1) {
      rules.splice(index, 1);
    }
  }

  // アバター画像のバリデーション
  async validateAvatar(file: File): Promise<ValidationResult> {
    const result = await this.validateImageFile(file);
    
    // アバター固有の追加チェック
    if (result.isValid) {
      const warnings = result.warnings || [];
      
      // アバターは正方形が推奨
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      return new Promise((resolve) => {
        img.onload = () => {
          URL.revokeObjectURL(url);
          if (img.width !== img.height) {
            warnings.push('アバター画像は正方形が推奨されます');
          }
          resolve({
            ...result,
            warnings: warnings.length > 0 ? warnings : undefined
          });
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve({
            isValid: false,
            error: '画像ファイルの読み込みに失敗しました'
          });
        };
        img.src = url;
      });
    }
    
    return result;
  }

  // サムネイル画像のバリデーション
  async validateThumbnail(file: File): Promise<ValidationResult> {
    const result = await this.validateImageFile(file);
    
    // サムネイル固有の追加チェック
    if (result.isValid) {
      const warnings = result.warnings || [];
      
      // サムネイルは16:9のアスペクト比が推奨
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      return new Promise((resolve) => {
        img.onload = () => {
          URL.revokeObjectURL(url);
          const aspectRatio = img.width / img.height;
          const targetRatio = 16 / 9;
          const tolerance = 0.1;
          
          if (Math.abs(aspectRatio - targetRatio) > tolerance) {
            warnings.push('サムネイル画像は16:9のアスペクト比が推奨されます');
          }
          
          resolve({
            ...result,
            warnings: warnings.length > 0 ? warnings : undefined
          });
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve({
            isValid: false,
            error: '画像ファイルの読み込みに失敗しました'
          });
        };
        img.src = url;
      });
    }
    
    return result;
  }

  // バリデーション設定を取得
  async getValidationConfig() {
    const config = await this.getConfig();
    return {
      video: {
        maxSizeMB: config.maxFileSizeMB,
        allowedTypes: Object.keys(ACCEPTED_VIDEO_TYPES),
        maxSize: config.maxFileSizeMB * 1024 * 1024
      },
      image: {
        maxSizeMB: config.maxImageSizeMB,
        allowedTypes: Object.keys(ACCEPTED_IMAGE_TYPES),
        maxSize: config.maxImageSizeMB * 1024 * 1024
      }
    };
  }

  // 動画ファイルかどうかを判定
  isVideoFile(file: File): boolean {
    const correctedFile = correctMimeType(file);
    return Object.keys(ACCEPTED_VIDEO_TYPES).includes(correctedFile.type);
  }

  // 画像ファイルかどうかを判定
  isImageFile(file: File): boolean {
    return Object.keys(ACCEPTED_IMAGE_TYPES).includes(file.type);
  }

  // ファイルサイズを読みやすい形式に変換
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // バリデーション結果のサマリーを作成
  createValidationSummary(results: ValidationResult[]): {
    totalFiles: number;
    validFiles: number;
    invalidFiles: number;
    totalWarnings: number;
    errors: string[];
    warnings: string[];
  } {
    const summary = {
      totalFiles: results.length,
      validFiles: 0,
      invalidFiles: 0,
      totalWarnings: 0,
      errors: [] as string[],
      warnings: [] as string[]
    };

    results.forEach(result => {
      if (result.isValid) {
        summary.validFiles++;
      } else {
        summary.invalidFiles++;
        if (result.error) {
          summary.errors.push(result.error);
        }
      }

      if (result.warnings) {
        summary.totalWarnings += result.warnings.length;
        summary.warnings.push(...result.warnings);
      }
    });

    return summary;
  }
}

// シングルトンインスタンスをエクスポート
export const validationService = ValidationService.getInstance(); 