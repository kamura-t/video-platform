import fs from 'fs';
import path from 'path';
import { prisma } from './prisma';
import { generateUniqueFileName } from './upload-utils';

// ストレージタイプ
export type StorageType = 'local' | 'nas';

// ストレージ設定
export interface StorageConfig {
  type: StorageType;
  basePath: string;
  urlPrefix: string;
  isAvailable: boolean;
}

// ファイル保存結果
export interface SaveFileResult {
  fileName: string;
  filePath: string;
  absolutePath: string;
  urlPath: string;
  size: number;
  mimeType: string;
  storageType: StorageType;
}

// ストレージサービスクラス
export class StorageService {
  private static instance: StorageService;
  private config: StorageConfig | null = null;
  private configTimestamp = 0;
  private readonly CONFIG_CACHE_DURATION = 5 * 60 * 1000; // 5分

  private constructor() {}

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  // ストレージ設定を取得
  private async getStorageConfig(): Promise<StorageConfig> {
    const now = Date.now();
    
    if (!this.config || now - this.configTimestamp > this.CONFIG_CACHE_DURATION) {
      try {
        const settings = await prisma.systemSetting.findMany({
          where: {
            settingKey: {
              in: ['nas_mount_path', 'nfs_mounted']
            }
          }
        });

        const settingsMap = settings.reduce((acc, setting) => {
          acc[setting.settingKey] = setting.settingValue || '';
          return acc;
        }, {} as { [key: string]: string });

        const nasPath = settingsMap.nas_mount_path || '/uploads/videos';
        const isNfsMounted = settingsMap.nfs_mounted === 'true';
        const isNasPath = nasPath.startsWith('/mnt/') || nasPath.startsWith('/nas/') || nasPath.startsWith('/Volumes/');

        if (isNasPath && isNfsMounted) {
          this.config = {
            type: 'nas',
            basePath: nasPath,
            urlPrefix: '/videos',
            isAvailable: this.checkNasAvailability(nasPath)
          };
        } else {
          // ローカルストレージ
          const localPath = isNasPath ? '/uploads/videos' : nasPath;
          this.config = {
            type: 'local',
            basePath: path.join(process.cwd(), 'public', localPath),
            urlPrefix: localPath,
            isAvailable: true
          };
        }

        this.configTimestamp = now;
      } catch (error) {
        console.error('Failed to get storage config:', error);
        // フォールバック設定
        this.config = {
          type: 'local',
          basePath: path.join(process.cwd(), 'public', 'uploads', 'videos'),
          urlPrefix: '/uploads/videos',
          isAvailable: true
        };
      }
    }

    return this.config;
  }

  // NASの可用性チェック
  private checkNasAvailability(nasPath: string): boolean {
    try {
      fs.accessSync(nasPath, fs.constants.R_OK | fs.constants.W_OK);
      return true;
    } catch (error) {
      console.warn(`NAS path ${nasPath} is not accessible:`, error);
      return false;
    }
  }

  // ディレクトリ作成
  private ensureDirectory(dirPath: string): void {
    try {
      if (!fs.existsSync(dirPath)) {
        console.log('Creating directory:', dirPath);
        fs.mkdirSync(dirPath, { recursive: true });
        console.log('Directory created successfully');
      }
    } catch (error) {
      console.error('Directory creation error:', error);
      throw new Error(`ディレクトリの作成に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ファイル保存
  async saveFile(
    file: File | Buffer,
    originalName: string,
    subDirectory: string = '',
    prefix?: string
  ): Promise<SaveFileResult> {
    const config = await this.getStorageConfig();
    
    if (!config.isAvailable) {
      throw new Error('ストレージが利用できません');
    }

    const fileName = generateUniqueFileName(originalName, prefix);
    const targetDir = subDirectory 
      ? path.join(config.basePath, subDirectory)
      : config.basePath;
    
    // ディレクトリを作成
    this.ensureDirectory(targetDir);

    const absolutePath = path.join(targetDir, fileName);
    const urlPath = subDirectory
      ? path.join(config.urlPrefix, subDirectory, fileName).replace(/\\/g, '/')
      : path.join(config.urlPrefix, fileName).replace(/\\/g, '/');

    // ファイルを保存
    let buffer: Buffer;
    let size: number;
    let mimeType: string;

    if (file instanceof File) {
      buffer = Buffer.from(await file.arrayBuffer());
      size = file.size;
      mimeType = file.type;
    } else {
      buffer = file;
      size = buffer.length;
      mimeType = 'application/octet-stream';
    }

    try {
      console.log('Attempting to save file to:', absolutePath);
      fs.writeFileSync(absolutePath, buffer);
      console.log('File saved successfully');
    } catch (error) {
      console.error('File save error:', error);
      throw new Error(`ファイルの保存に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      fileName,
      filePath: urlPath,
      absolutePath,
      urlPath,
      size,
      mimeType,
      storageType: config.type
    };
  }

  // 動画ファイル保存
  async saveVideoFile(
    file: File | Buffer,
    originalName: string,
    videoId?: string
  ): Promise<SaveFileResult> {
    const subDirectory = 'original'; // GPUサーバと統一（日付階層なし）
    // プレフィックスを削除（GPU変換サーバーが適切に処理するため）
  
    return this.saveFile(file, originalName, subDirectory);
  }

  // サムネイル保存
  async saveThumbnail(
    file: File | Buffer,
    originalName: string,
    videoId?: string
  ): Promise<SaveFileResult> {
    const subDirectory = 'thumbnails'; // GPUサーバと統一（日付階層なし）
    const prefix = videoId ? `${videoId}_thumb` : 'thumb';
    
    return this.saveFile(file, originalName, subDirectory, prefix);
  }



  // アバター保存（NASに保存）
  async saveAvatar(
    file: File | Buffer,
    originalName: string,
    userId: string
  ): Promise<SaveFileResult> {
    const subDirectory = 'avatars';
    const prefix = `user_${userId}`;
    
    return this.saveFile(file, originalName, subDirectory, prefix);
  }

  // ロゴ保存（NASに保存）
  async saveLogo(
    file: File | Buffer,
    originalName: string
  ): Promise<SaveFileResult> {
    const subDirectory = 'logos';
    const prefix = 'logo';
    
    return this.saveFile(file, originalName, subDirectory, prefix);
  }

  // 古いアバター画像を削除してから新しいアバターを保存
  async updateAvatar(
    file: File | Buffer,
    originalName: string,
    userId: string,
    oldAvatarPath?: string
  ): Promise<SaveFileResult> {
    // 古いアバター画像を削除
    if (oldAvatarPath) {
      try {
        await this.deleteFile(oldAvatarPath);
        console.log(`Old avatar deleted: ${oldAvatarPath}`);
      } catch (error) {
        console.warn(`Failed to delete old avatar: ${oldAvatarPath}`, error);
        // 古いファイルの削除に失敗しても新しいファイルの保存は続行
      }
    }

    // 新しいアバターを保存
    return this.saveAvatar(file, originalName, userId);
  }

  // アバター削除（ユーザー削除時など）
  async deleteAvatar(avatarPath: string): Promise<boolean> {
    try {
      const deleted = await this.deleteFile(avatarPath);
      if (deleted) {
        console.log(`Avatar deleted: ${avatarPath}`);
      }
      return deleted;
    } catch (error) {
      console.error(`Failed to delete avatar: ${avatarPath}`, error);
      return false;
    }
  }

  // 日付ベースのパス生成
  private generateDateBasedPath(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    return path.join(year.toString(), month, day);
  }

  // ファイル削除
  async deleteFile(filePath: string): Promise<boolean> {
    try {
      let absolutePath: string;

      // `/videos` で始まるパスはURLパスなので、絶対パスとして扱わない
      if (path.isAbsolute(filePath) && !filePath.startsWith('/videos')) {
        absolutePath = filePath;
      } else {
        const config = await this.getStorageConfig();
        
        // URLパスからファイルパスに変換
        let relativePath = filePath;
        if (filePath.startsWith(config.urlPrefix)) {
          relativePath = filePath.replace(config.urlPrefix, '');
          if (relativePath.startsWith('/')) {
            relativePath = relativePath.substring(1);
          }
        }
        
        absolutePath = path.join(config.basePath, relativePath);
      }

      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to delete file:', error);
      return false;
    }
  }

  // ファイル存在チェック
  async fileExists(filePath: string): Promise<boolean> {
    try {
      let absolutePath: string;

      if (path.isAbsolute(filePath)) {
        absolutePath = filePath;
      } else {
        // 従来通りの設定を使用
        const config = await this.getStorageConfig();
        absolutePath = path.join(config.basePath, filePath.replace(config.urlPrefix, ''));
      }

      return fs.existsSync(absolutePath);
    } catch (error) {
      console.error('Failed to check file existence:', error);
      return false;
    }
  }

  // ストレージ情報取得
  async getStorageInfo(): Promise<{
    type: StorageType;
    isAvailable: boolean;
    basePath: string;
    urlPrefix: string;
  }> {
    const config = await this.getStorageConfig();
    return {
      type: config.type,
      isAvailable: config.isAvailable,
      basePath: config.basePath,
      urlPrefix: config.urlPrefix
    };
  }

  // ファイルをアーカイブフォルダに移動
  async moveToArchive(
    filePath: string,
    videoId: string,
    uploaderId: number
  ): Promise<string> {
    const config = await this.getStorageConfig();
    const archiveBasePath = path.join(process.cwd(), 'storage', 'archived');
    
    // アーカイブディレクトリを作成
    this.ensureDirectory(archiveBasePath);

    // 日付フォルダを作成
    const today = new Date().toISOString().split('T')[0];
    const dateFolderPath = path.join(archiveBasePath, today);
    this.ensureDirectory(dateFolderPath);

    // 元ファイルの絶対パス
    const sourceAbsolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(config.basePath, filePath.replace(config.urlPrefix, ''));

    if (!fs.existsSync(sourceAbsolutePath)) {
      throw new Error(`ファイルが見つかりません: ${sourceAbsolutePath}`);
    }

    // 新しいファイル名を生成
    const timestamp = Date.now();
    const originalFileName = path.basename(filePath);
    const fileExtension = path.extname(originalFileName);
    const baseFileName = path.basename(originalFileName, fileExtension);
    const newFileName = `${videoId}_${uploaderId}_${timestamp}_${baseFileName}${fileExtension}`;
    
    const archivePath = path.join(dateFolderPath, newFileName);

    // ファイルを移動
    fs.renameSync(sourceAbsolutePath, archivePath);

    // 相対パスを返す
    return path.relative(process.cwd(), archivePath);
  }
}

// デフォルトインスタンス
export const storageService = StorageService.getInstance(); 