import { prisma } from './prisma';

// サーバーサイドチェック
const isServer = typeof window === 'undefined';

// 設定値の型
export type SettingType = 'STRING' | 'INTEGER' | 'BOOLEAN' | 'JSON' | 'SERVER_IP' | 'FILE_PATH' | 'PORT';

// 設定項目の定義
export interface SettingDefinition {
  key: string;
  type: SettingType;
  defaultValue: string;
  description: string;
  validation?: (value: string) => boolean;
}

// 設定値
export interface Setting {
  key: string;
  value: string;
  type: SettingType;
  description: string;
}

// 設定グループ
export interface SettingGroup {
  name: string;
  description: string;
  settings: Setting[];
}

// 設定管理サービス
export class ConfigService {
  private static instance: ConfigService;
  private cache: Map<string, string> = new Map();
  private cacheTimestamp = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5分

  private constructor() {
    // サーバーサイドでのみ初期化
    if (!isServer) {
      throw new Error('ConfigService can only be used on the server side');
    }
  }

  public static getInstance(): ConfigService {
    if (!isServer) {
      throw new Error('ConfigService can only be used on the server side');
    }
    
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  // キャッシュをクリア
  clearCache(): void {
    if (!isServer) {
      throw new Error('ConfigService can only be used on the server side');
    }
    this.cache.clear();
    this.cacheTimestamp = 0;
  }

  // 設定を取得（キャッシュ付き）
  async get(key: string, defaultValue?: string): Promise<string | null> {
    if (!isServer) {
      throw new Error('ConfigService can only be used on the server side');
    }
    await this.refreshCacheIfNeeded();
    return this.cache.get(key) || defaultValue || null;
  }

  // 複数の設定を一括取得
  async getMultiple(keys: string[]): Promise<{ [key: string]: string }> {
    if (!isServer) {
      throw new Error('ConfigService can only be used on the server side');
    }
    await this.refreshCacheIfNeeded();
    
    const result: { [key: string]: string } = {};
    keys.forEach(key => {
      const value = this.cache.get(key);
      if (value !== undefined) {
        result[key] = value;
      }
    });
    
    return result;
  }

  // 設定を取得（型付き）
  async getString(key: string, defaultValue?: string): Promise<string> {
    if (!isServer) {
      throw new Error('ConfigService can only be used on the server side');
    }
    const value = await this.get(key, defaultValue);
    return value || '';
  }

  async getNumber(key: string, defaultValue?: number): Promise<number> {
    if (!isServer) {
      throw new Error('ConfigService can only be used on the server side');
    }
    const value = await this.get(key);
    if (value === null) return defaultValue || 0;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? (defaultValue || 0) : parsed;
  }

  async getBoolean(key: string, defaultValue?: boolean): Promise<boolean> {
    if (!isServer) {
      throw new Error('ConfigService can only be used on the server side');
    }
    const value = await this.get(key);
    if (value === null) return defaultValue || false;
    return value.toLowerCase() === 'true';
  }

  async getJSON<T>(key: string, defaultValue?: T): Promise<T | null> {
    if (!isServer) {
      throw new Error('ConfigService can only be used on the server side');
    }
    const value = await this.get(key);
    if (value === null) return defaultValue || null;
    
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`Failed to parse JSON setting ${key}:`, error);
      return defaultValue || null;
    }
  }

  // 設定を更新
  async set(key: string, value: string, type: SettingType = 'STRING', description?: string): Promise<void> {
    if (!isServer) {
      throw new Error('ConfigService can only be used on the server side');
    }
    try {
      await prisma.systemSetting.upsert({
        where: { settingKey: key },
        update: {
          settingValue: value,
          updatedAt: new Date()
        },
        create: {
          settingKey: key,
          settingValue: value,
          settingType: type,
          description: description || `${key}の設定`,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      // キャッシュを更新
      this.cache.set(key, value);
    } catch (error) {
      console.error(`Failed to set setting ${key}:`, error);
      throw error;
    }
  }

  // 複数の設定を一括更新
  async setMultiple(settings: { key: string; value: string; type?: SettingType; description?: string }[]): Promise<void> {
    if (!isServer) {
      throw new Error('ConfigService can only be used on the server side');
    }
    try {
      const updatePromises = settings.map(setting =>
        this.set(setting.key, setting.value, setting.type, setting.description)
      );
      
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Failed to set multiple settings:', error);
      throw error;
    }
  }

  // 設定を削除
  async delete(key: string): Promise<void> {
    if (!isServer) {
      throw new Error('ConfigService can only be used on the server side');
    }
    try {
      await prisma.systemSetting.delete({
        where: { settingKey: key }
      });

      this.cache.delete(key);
    } catch (error) {
      console.error(`Failed to delete setting ${key}:`, error);
      throw error;
    }
  }

  // 全設定を取得
  async getAll(): Promise<Setting[]> {
    if (!isServer) {
      throw new Error('ConfigService can only be used on the server side');
    }
    try {
      const settings = await prisma.systemSetting.findMany({
        orderBy: { settingKey: 'asc' }
      });

      return settings.map(setting => ({
        key: setting.settingKey,
        value: setting.settingValue || '',
        type: setting.settingType as SettingType,
        description: setting.description || ''
      }));
    } catch (error) {
      console.error('Failed to get all settings:', error);
      throw error;
    }
  }

  // 設定をグループ別に取得
  async getByGroup(): Promise<SettingGroup[]> {
    if (!isServer) {
      throw new Error('ConfigService can only be used on the server side');
    }
    const allSettings = await this.getAll();
    
    const groups: { [key: string]: Setting[] } = {
      site: [],
      upload: [],
      storage: [],
      gpu: [],
      security: [],
      api: [],
      privacy: [],
      other: []
    };

    allSettings.forEach(setting => {
      if (setting.key.startsWith('site_')) {
        groups.site.push(setting);
      } else if (setting.key.includes('file_size') || setting.key.includes('upload')) {
        groups.upload.push(setting);
      } else if (setting.key.includes('nas_') || setting.key.includes('storage')) {
        groups.storage.push(setting);
      } else if (setting.key.includes('gpu_') || setting.key.includes('transcoding')) {
        groups.gpu.push(setting);
      } else if (setting.key.includes('session') || setting.key.includes('password') || setting.key.includes('security')) {
        groups.security.push(setting);
      } else if (setting.key.includes('api_') || setting.key.includes('youtube')) {
        groups.api.push(setting);
      } else if (setting.key.includes('view_history') || setting.key.includes('retention') || setting.key.includes('privacy')) {
        groups.privacy.push(setting);
      } else {
        groups.other.push(setting);
      }
    });

    return [
      { name: 'サイト設定', description: 'サイトの基本設定', settings: groups.site },
      { name: 'アップロード設定', description: 'ファイルアップロードに関する設定', settings: groups.upload },
      { name: 'ストレージ設定', description: 'ファイル保存に関する設定', settings: groups.storage },
      { name: 'GPU変換設定', description: '動画変換処理に関する設定', settings: groups.gpu },
      { name: 'セキュリティ設定', description: 'セキュリティに関する設定', settings: groups.security },
      { name: 'API設定', description: '外部API連携の設定', settings: groups.api },
      { name: 'プライバシー設定', description: 'データ保持・プライバシーに関する設定', settings: groups.privacy },
      { name: 'その他の設定', description: 'その他の設定', settings: groups.other }
    ].filter(group => group.settings.length > 0);
  }

  // キャッシュの更新
  private async refreshCacheIfNeeded(): Promise<void> {
    if (!isServer) {
      throw new Error('ConfigService can only be used on the server side');
    }
    const now = Date.now();
    
    if (this.cache.size === 0 || now - this.cacheTimestamp > this.CACHE_DURATION) {
      try {
        const settings = await prisma.systemSetting.findMany({
          where: { isActive: true }
        });

        this.cache.clear();
        settings.forEach(setting => {
          if (setting.settingValue !== null) {
            this.cache.set(setting.settingKey, setting.settingValue);
          }
        });

        this.cacheTimestamp = now;
      } catch (error) {
        console.error('Failed to refresh settings cache:', error);
      }
    }
  }

  // よく使用される設定のヘルパーメソッド
  async getUploadConfig() {
    if (!isServer) {
      throw new Error('ConfigService can only be used on the server side');
    }
    return {
      maxFileSizeMB: await this.getNumber('max_file_size_mb', 5120),
      maxImageSizeMB: await this.getNumber('max_image_size_mb', 2),
      allowedFileTypes: await this.getString('allowed_file_types', 'mp4,mov,avi,mkv,wmv,flv,webm'),
      nasPath: await this.getString('nas_mount_path', '/uploads/videos'),
      isNfsMounted: await this.getBoolean('nfs_mounted', false)
    };
  }

  async getGpuConfig() {
    if (!isServer) {
      throw new Error('ConfigService can only be used on the server side');
    }
    return {
      serverUrl: await this.getString('gpu_server_url', 'http://172.16.1.172:3001'),
      serverIp: await this.getString('gpu_server_ip', '172.16.1.172'),
      isEnabled: await this.getBoolean('gpu_transcoding_enabled', true),
      timeout: await this.getNumber('transcoding_timeout_seconds', 3600)
    };
  }

  async getSiteConfig() {
    if (!isServer) {
      throw new Error('ConfigService can only be used on the server side');
    }
    return {
      title: await this.getString('site_title', 'VideoShare'),
      description: await this.getString('site_description', '組織向け動画プラットフォーム'),
      logoIcon: await this.getString('site_logo_icon', 'Video'),
      logoImage: await this.getString('site_logo_image', ''),
      videosPerPage: await this.getNumber('videos_per_page', 20),
      newBadgeDisplayDays: await this.getNumber('new_badge_display_days', 7)
    };
  }

  async getSecurityConfig() {
    if (!isServer) {
      throw new Error('ConfigService can only be used on the server side');
    }
    return {
      sessionTimeout: await this.getNumber('session_timeout', 1800),
      maxLoginAttempts: await this.getNumber('max_login_attempts', 10),
      lockoutDuration: await this.getNumber('lockout_duration', 1800),
      privateVideoAllowedIps: await this.getJSON<string[]>('private_video_allowed_ips', [])
    };
  }

  // 初期設定をセットアップ
  async setupDefaultSettings(): Promise<void> {
    if (!isServer) {
      throw new Error('ConfigService can only be used on the server side');
    }
    const defaultSettings = [
      { key: 'site_title', value: 'VideoShare', type: 'STRING' as SettingType, description: 'サイトのタイトル' },
      { key: 'site_description', value: '組織向け動画プラットフォーム', type: 'STRING' as SettingType, description: 'サイトの説明' },
      { key: 'site_logo_icon', value: 'Video', type: 'STRING' as SettingType, description: 'ロゴアイコン' },
      { key: 'max_file_size_mb', value: '5120', type: 'INTEGER' as SettingType, description: '最大ファイルサイズ（MB）' },
      { key: 'max_image_size_mb', value: '2', type: 'INTEGER' as SettingType, description: '最大画像サイズ（MB）' },

      { key: 'allowed_file_types', value: 'mp4,mov,avi,mkv,wmv,flv,webm', type: 'STRING' as SettingType, description: '許可するファイル形式' },
      { key: 'nas_mount_path', value: '/uploads/videos', type: 'FILE_PATH' as SettingType, description: '動画保存パス' },
      { key: 'nfs_mounted', value: 'false', type: 'BOOLEAN' as SettingType, description: 'NFSマウント状態' },
      { key: 'gpu_server_url', value: 'http://172.16.1.172:3001', type: 'STRING' as SettingType, description: 'GPU変換サーバーURL' },
      { key: 'gpu_transcoding_enabled', value: 'true', type: 'BOOLEAN' as SettingType, description: 'GPU変換機能有効化' },
      { key: 'session_timeout', value: '1800', type: 'INTEGER' as SettingType, description: 'セッションタイムアウト（秒）' },
      { key: 'videos_per_page', value: '20', type: 'INTEGER' as SettingType, description: '1ページあたりの動画表示数' },
      { key: 'new_badge_display_days', value: '7', type: 'INTEGER' as SettingType, description: '新着バッジ表示日数' },
      { key: 'private_video_allowed_ips', value: '[]', type: 'JSON' as SettingType, description: '学内限定動画にアクセス可能なIPアドレス（JSON配列）' },
      { key: 'youtube_api_key', value: '', type: 'STRING' as SettingType, description: 'YouTube Data API v3 キー' },
      { key: 'view_history_retention_days', value: '1825', type: 'INTEGER' as SettingType, description: '視聴履歴の保持期間（日数）' }
    ];

    for (const setting of defaultSettings) {
      try {
        await prisma.systemSetting.upsert({
          where: { settingKey: setting.key },
          update: {},
          create: {
            settingKey: setting.key,
            settingValue: setting.value,
            settingType: setting.type,
            description: setting.description,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      } catch (error) {
        console.error(`Failed to setup default setting ${setting.key}:`, error);
      }
    }

    // キャッシュをクリア
    this.clearCache();
  }
}

// デフォルトインスタンス
export const configService = isServer ? ConfigService.getInstance() : null; 