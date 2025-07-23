// GPU Transcoding Server Client Library
import axios, { AxiosInstance } from 'axios';

// Types
export interface TranscodeJob {
  id: string;
  progress: number;
  state: 'waiting' | 'active' | 'completed' | 'failed';
  data: {
    inputFile: string;
    outputFile: string;
    preset: string;
    originalName?: string;
  };
  processedOn?: number;
  finishedOn?: number;
  returnvalue?: {
    status: string;
    outputFile: string;
    inputSizeMB: number;
    outputSizeMB: number;
    processingTime: number;
    preset: string;
    compressionRate: string;
    outputMetadata?: {
      duration: number;
      streams: Array<{
        codec_type: string;
        codec_name: string;
        width: number;
        height: number;
        bitrate: number;
      }>;
    };
    thumbnailPath?: string;
    efficiency: string;
  };
  completed?: {
    outputFile: string;
    outputSize: number;
    preset: string;
    processingTime: number;
    inputSizeMB?: number;
    compressionRate?: number;
    efficiency?: string;
    thumbnailPath?: string; // 生成されたサムネイルのパス
    outputMetadata?: {
      duration: number;
      resolution: string;
      width: number;
      height: number;
      codec: string;
      video?: {
        codec_name: string;
        width: number;
        height: number;
        bitrate: number;
        frame_rate: number;
        pixel_format: string;
        aspect_ratio: string;
        color_space: string;
      };
      audio?: {
        codec_name: string;
        bitrate: number;
        sample_rate: number;
        channels: number;
        channel_layout: string;
        sample_fmt: string;
      };
    };
    videoDetails?: {
      resolution: string;
      width: number;
      height: number;
      bitrate: number;
      frameRate: number;
      codec: string;
    };
    audioDetails?: {
      codec: string;
      bitrate: number;
      sampleRate: number;
      channels: number;
    };
  };
}

export interface SystemStatus {
  system: {
    gpu: {
      utilization: number;
      memoryUsed: number;
      memoryTotal: number;
      temperature: number;
    };
    system: {
      ramUsage: number;
      tmpfsUsage: number;
      loadAverage: number;
    };
    timestamp: string;
  };
  queue: {
    active: number;
    waiting: number;
    completed: number;
    failed: number;
  };
  capacity: {
    availableForNewJobs: boolean;
    tmpfsUsage: number;
    ramUsage: number;
    gpuUsage: number;
  };
  performance: {
    gpu: string;
    ram: string;
    tmpfs: string;
    version: string;
  };
}

export interface UploadAndTranscodeResponse {
  success: boolean;
  jobId: string;
  inputFile: string;
  outputFile: string;
  preset: string;
  estimatedDuration: number;
  videoInfo: {
    width: number;
    height: number;
    duration: number;
  };
  message: string;
  thumbnailPath?: string;
}

export interface TranscodeResponse {
  success: boolean;
  jobId: string;
  preset: string;
  systemStatus: SystemStatus;
  message: string;
}

export interface PresetDetails {
  description: string;
  videoCodec: string;
  audioCodec: string;
  resolution: string;
  bitrate: string;
  fps: number;
}

export interface PresetsResponse {
  presets: string[];
  details: Record<string, PresetDetails>;
}

export interface TranscodeMetadata {
  title?: string;
  videoId?: string;
  originalFilename?: string;
  generateThumbnail?: boolean;
  thumbnailTimestamp?: number;
  [key: string]: any;
}

export interface VideoMetadata {
  video: {
    resolution: string;
    bitrate: string;
    frameRate: string;
    codec: string;
    pixelFormat: string;
    aspectRatio: string;
    colorSpace: string;
  };
  audio: {
    bitrate: string;
    sampleRate: string;
    channels: number;
    channelLayout: string;
    sampleFormat: string;
  };
}

// GPU Transcoder Client Class
export class GPUTranscoderClient {
  private client: AxiosInstance;
  private baseURL: string;

  constructor(baseURL?: string) {
    this.baseURL = baseURL || process.env.GPU_SERVER_URL || 'http://172.16.1.172:3001';
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 120000, // 120秒タイムアウト（長時間動画対応）
    });
  }

  // 共通のエラーハンドリング
  private handleError(error: any, operation: string): never {
    console.error(`GPU ${operation} failed:`, {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        baseURL: error.config?.baseURL
      }
    });
    
    // より詳細なエラーメッセージを提供
    let errorMessage = `GPU ${operation} failed`;
    if (error.response?.status) {
      errorMessage += ` (HTTP ${error.response.status})`;
    }
    if (error.response?.data?.error) {
      errorMessage += `: ${error.response.data.error}`;
    } else if (error.message) {
      errorMessage += `: ${error.message}`;
    }
    
    throw new GPUTranscoderError(errorMessage, error.response?.status, error);
  }

  // FormData作成の共通処理
  private createFormData(
    file: File | Buffer,
    preset: string,
    outputPath?: string,
    metadata?: TranscodeMetadata
  ): FormData {
    const formData = new FormData();
    
    if (file instanceof File) {
      formData.append('video', file);
    } else {
      // Node.js環境でのBuffer処理
      const { Readable } = require('stream');
      
      // BufferをStreamに変換
      const stream = Readable.from(file);
      formData.append('video', stream, metadata?.originalFilename || 'video.mp4');
    }
    
    formData.append('preset', preset);
    
    if (outputPath) {
      formData.append('outputPath', outputPath);
    }

    // サムネイル生成オプション
    if (metadata?.generateThumbnail !== false) {
      formData.append('generateThumbnail', 'true');
      formData.append('thumbnailTimestamp', (metadata?.thumbnailTimestamp || 5).toString());
      formData.append('thumbnailFormat', 'webp'); // WebP形式でサムネイル生成
      formData.append('thumbnailQuality', '85'); // WebP品質設定
      formData.append('thumbnailSize', '1280x720'); // サムネイルサイズ（1280x720）
      formData.append('thumbnailWidth', '1280'); // サムネイル幅
      formData.append('thumbnailHeight', '720'); // サムネイル高さ
    }
    
    if (metadata) {
      // サムネイル関連以外のメタデータを追加
      const { generateThumbnail, thumbnailTimestamp, ...otherMetadata } = metadata;
      if (Object.keys(otherMetadata).length > 0) {
        formData.append('metadata', JSON.stringify(otherMetadata));
      }
    }

    return formData;
  }

  // ファイルアップロード + 変換（サムネイル生成付き）
  async uploadAndTranscode(
    file: File | Buffer,
    preset: string = 'web_1080p',
    outputPath?: string,
    metadata?: TranscodeMetadata
  ): Promise<UploadAndTranscodeResponse> {
    try {
      console.log('🚀 GPU upload and transcode request:', {
        fileSize: file instanceof File ? file.size : file.length,
        preset,
        outputPath,
        metadata,
        baseURL: this.baseURL
      });
      
      // Node.js環境でのFormData処理
      const FormData = require('form-data');
      const formData = new FormData();
      
      if (file instanceof File) {
        formData.append('video', file);
      } else {
        // Bufferの場合はStreamとして追加
        const { Readable } = require('stream');
        const stream = Readable.from(file);
        formData.append('video', stream, {
          filename: metadata?.originalFilename || 'video.mp4',
          contentType: 'video/mp4'
        });
      }
      
      formData.append('preset', preset);
      
      if (outputPath) {
        formData.append('outputPath', outputPath);
      }

      // サムネイル生成オプション
      if (metadata?.generateThumbnail !== false) {
        formData.append('generateThumbnail', 'true');
        formData.append('thumbnailTimestamp', (metadata?.thumbnailTimestamp || 5).toString());
        formData.append('thumbnailFormat', 'webp');
        formData.append('thumbnailQuality', '85');
        formData.append('thumbnailSize', '1280x720');
        formData.append('thumbnailWidth', '1280');
        formData.append('thumbnailHeight', '720');
      }
      
      if (metadata) {
        const { generateThumbnail, thumbnailTimestamp, ...otherMetadata } = metadata;
        if (Object.keys(otherMetadata).length > 0) {
          formData.append('metadata', JSON.stringify(otherMetadata));
        }
      }

      console.log('🔍 GPU server URL:', this.baseURL);
      console.log('📦 FormData contents:', {
        preset: preset,
        outputPath: outputPath,
        generateThumbnail: metadata?.generateThumbnail || false,
        thumbnailTimestamp: metadata?.thumbnailTimestamp || 5,
        hasFile: !!file
      });

      const response = await this.client.post('/upload-and-transcode', formData, {
        headers: {
          ...formData.getHeaders(),
        },
      });

      console.log('✅ GPU server response:', {
        status: response.status,
        statusText: response.statusText,
        data: response.data
      });

      return response.data;
    } catch (error: any) {
      this.handleError(error, 'upload and transcode');
    }
  }

  // 既存ファイルの変換依頼
  async transcode(
    inputFile: string,
    outputFile: string,
    preset: string = 'web_1080p',
    metadata?: Record<string, any>
  ): Promise<TranscodeResponse> {
    try {
      console.log('GPU transcoding request:', {
        inputFile,
        outputFile,
        preset,
        metadata
      });
      
      const response = await this.client.post('/transcode', {
        inputFile,
        outputFile,
        preset,
        metadata,
      });

      return response.data;
    } catch (error: any) {
      this.handleError(error, 'transcoding');
    }
  }

  // ジョブ状態確認
  async getJobStatus(jobId: string): Promise<TranscodeJob> {
    try {
      const response = await this.client.get(`/job/${jobId}`);
      return response.data;
    } catch (error: any) {
      this.handleError(error, 'job status check');
    }
  }

  // 軽量版の進捗取得（推奨）
  async getJobProgress(jobId: string): Promise<{
    id: string;
    progress: number;
    state: string;
    status: string;
    estimatedTimeRemaining: number | null;
    currentTime: number;
    timestamp: string;
  }> {
    try {
      const response = await this.client.get(`/job/${jobId}/progress`);
      return response.data;
    } catch (error: any) {
      // フォールバック: 通常のジョブ状態取得
      const fullStatus = await this.getJobStatus(jobId);
      return {
        id: fullStatus.id,
        progress: fullStatus.progress,
        state: fullStatus.state,
        status: 'processing',
        estimatedTimeRemaining: null,
        currentTime: 0,
        timestamp: new Date().toISOString()
      };
    }
  }



  // システム状態確認
  async getSystemStatus(): Promise<SystemStatus> {
    try {
      const response = await this.client.get('/status');
      return response.data;
    } catch (error: any) {
      this.handleError(error, 'system status check');
    }
  }

  // プリセット一覧
  async getPresets(): Promise<PresetsResponse> {
    try {
      const response = await this.client.get('/presets');
      return response.data;
    } catch (error: any) {
      this.handleError(error, 'presets fetch');
    }
  }

  // キュー統計
  async getQueueStats() {
    const response = await this.client.get('/queue/stats');
    return response.data;
  }

  // キューをクリア
  async clearQueue() {
    const response = await this.client.delete('/queue/clear');
    return response.data;
  }

  // ヘルスチェック
  async healthCheck() {
    const response = await this.client.get('/health');
    return response.data;
  }

  // 利用可能なAPIエンドポイントを確認
  async checkAvailableEndpoints(): Promise<{
    health: boolean;
    jobStatus: boolean;
    jobProgress: boolean;
    systemStatus: boolean;
    presets: boolean;
  }> {
    const results = {
      health: false,
      jobStatus: false,
      jobProgress: false,
      systemStatus: false,
      presets: false
    };

    try {
      // ヘルスチェック
      try {
        await this.client.get('/health');
        results.health = true;
      } catch (error) {
        // エラーは無視
      }

      // システム状態
      try {
        await this.client.get('/status');
        results.systemStatus = true;
      } catch (error) {
        // エラーは無視
      }

      // プリセット一覧
      try {
        await this.client.get('/presets');
        results.presets = true;
      } catch (error) {
        // エラーは無視
      }

      // ジョブ状態（テスト用のジョブIDで確認）
      try {
        await this.client.get('/job/test');
        results.jobStatus = true;
      } catch (error: any) {
        if (error.response?.status === 404) {
          // 404エラーは正常（テストジョブが存在しないため）
          results.jobStatus = true;
        }
      }

      // 軽量版進捗取得
      try {
        await this.client.get('/job/test/progress');
        results.jobProgress = true;
      } catch (error: any) {
        // 404エラーは軽量版APIが利用不可を意味する
      }

      return results;
    } catch (error) {
      return results;
    }
  }

  // 動画メタデータ取得
  async getVideoMetadata(filePath: string) {
    try {
      console.log('🔍 GPU変換サーバーメタデータ取得:', filePath);
      
      // GPU変換サーバーの正しいメタデータ取得APIを使用
      const response = await this.client.post('/video/metadata', {
        filePath: filePath
      });
      
      console.log('✅ GPU変換サーバーメタデータ取得成功:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ GPU変換サーバーメタデータ取得エラー:', error);
      // エラーが発生してもnullを返す（処理を続行）
      return null;
    }
  }

  // 動的ビットレート分析
  async analyzeBitrate(inputFile: string) {
    try {
      console.log('🔍 ビットレート分析開始:', inputFile);
      
      const response = await this.client.post('/analyze-bitrate', {
        inputFile: inputFile
      });
      
      console.log('✅ ビットレート分析成功:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ ビットレート分析エラー:', error);
      throw new GPUTranscoderError('ビットレート分析に失敗しました', error.response?.status, error);
    }
  }

  // GPUサーバー側のビットレート分析を使用
  async analyzeVideoQuality(inputFile: string): Promise<{
    quality: 'high' | 'medium' | 'low';
    bitrateAnalysis: any;
    recommendations: any;
  } | null> {
    try {
      console.log('🔍 GPUサーバーでビットレート分析開始:', inputFile);
      
      const response = await this.client.post('/analyze-bitrate', {
        inputFile: inputFile
      });
      
      if (response.data.success) {
        const analysis = response.data.analysis;
        const quality = analysis.qualityLevel as 'high' | 'medium' | 'low';
        
        console.log('✅ GPUサーバービットレート分析成功:', {
          quality: quality,
          currentBitrate: analysis.currentBitrate,
          standardBitrate: analysis.standardBitrate,
          bitrateRatio: analysis.bitrateRatio
        });
        
        return {
          quality: quality,
          bitrateAnalysis: analysis,
          recommendations: response.data.recommendations
        };
      }
      
      return null;
    } catch (error: any) {
      console.error('❌ GPUサーバービットレート分析エラー:', error);
      return null;
    }
  }

  // 動的ビットレート変換
  async transcodeDynamic(
    inputFile: string,
    outputFile: string,
    quality: 'maintain' | 'optimize' | 'high' | 'low' | 'special' = 'optimize'
  ) {
    try {
      console.log('🔍 動的ビットレート変換開始:', { inputFile, outputFile, quality });
      
      const response = await this.client.post('/transcode-dynamic', {
        inputFile: inputFile,
        outputFile: outputFile,
        quality: quality
      });
      
      console.log('✅ 動的ビットレート変換成功:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ 動的ビットレート変換エラー:', error);
      throw new GPUTranscoderError('動的ビットレート変換に失敗しました', error.response?.status, error);
    }
  }

  // 共通のジョブ監視処理
  private async pollJob(
    jobId: string,
    onProgress: (job: TranscodeJob) => void,
    onComplete: (job: TranscodeJob) => void,
    onError: (error: Error) => void,
    pollInterval: number = 2000
  ): Promise<void> {
    const poll = async () => {
      try {
        const job = await this.getJobStatus(jobId);
        onProgress(job);

        if (job.state === 'completed') {
          onComplete(job);
          return;
        }

        if (job.state === 'failed') {
          onError(new Error('変換に失敗しました'));
          return;
        }

        setTimeout(poll, pollInterval);
      } catch (error) {
        console.error('Job polling error:', error);
        setTimeout(poll, 5000); // エラー時は5秒後にリトライ
      }
    };

    poll();
  }

  // ジョブ監視（単一）
  async watchJob(
    jobId: string,
    onProgress: (job: TranscodeJob) => void,
    onComplete: (job: TranscodeJob) => void,
    onError: (error: Error) => void,
    pollInterval: number = 2000
  ): Promise<void> {
    return this.pollJob(jobId, onProgress, onComplete, onError, pollInterval);
  }

  // 複数ジョブの監視
  async watchMultipleJobs(
    jobIds: string[],
    onProgress: (jobId: string, job: TranscodeJob) => void,
    onComplete: (jobId: string, job: TranscodeJob) => void,
    onError: (jobId: string, error: Error) => void,
    pollInterval: number = 2000
  ): Promise<void> {
    const activeJobs = new Set(jobIds);

    const poll = async () => {
      if (activeJobs.size === 0) return;

      try {
        const promises = Array.from(activeJobs).map(async (jobId) => {
          try {
            const job = await this.getJobStatus(jobId);
            onProgress(jobId, job);

            if (job.state === 'completed') {
              onComplete(jobId, job);
              activeJobs.delete(jobId);
            } else if (job.state === 'failed') {
              onError(jobId, new Error('変換に失敗しました'));
              activeJobs.delete(jobId);
            }
          } catch (error) {
            console.error(`Job ${jobId} polling error:`, error);
          }
        });

        await Promise.all(promises);

        if (activeJobs.size > 0) {
          setTimeout(poll, pollInterval);
        }
      } catch (error) {
        console.error('Multiple job polling error:', error);
        setTimeout(poll, 5000);
      }
    };

    poll();
  }

  // サーバーの可用性チェック
  async isServerAvailable(): Promise<boolean> {
    try {
      console.log('🔍 GPUサーバー可用性チェック開始:', this.baseURL);
      const status = await this.getSystemStatus();
      console.log('✅ GPUサーバー状態レスポンス:', {
        availableForNewJobs: status.capacity.availableForNewJobs,
        gpuUsage: status.capacity.gpuUsage,
        queueActive: status.queue.active,
        queueWaiting: status.queue.waiting
      });
      const isAvailable = status.capacity.availableForNewJobs;
      console.log('✅ GPUサーバー新規ジョブ受付可能:', isAvailable);
      return isAvailable;
    } catch (error: any) {
      console.error('❌ GPUサーバー可用性チェック失敗:', error);
      console.error('❌ 可用性チェックエラー詳細:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      return false;
    }
  }

  // 最適なプリセットを取得（GPUサーバー側の自動選択を優先）
  getOptimalPreset(fileSize: number, duration: number, originalQuality?: 'high' | 'medium' | 'low'): string {
    // 基本的なプリセット選択（GPUサーバー側の自動選択が利用できない場合のフォールバック）
    const sizeMB = fileSize / (1024 * 1024);
    const durationMinutes = duration / 60;

    // 元の動画の品質を考慮したプリセット選択
    if (originalQuality === 'high') {
      // 高品質動画の場合は品質を維持
      if (sizeMB > 1000 || durationMinutes > 60) {
        return 'web_2k'; // 大きなファイルは2Kで高品質維持
      } else {
        return 'web_1080p'; // 中程度のファイルは1080pで高品質維持
      }
    }

    // 長時間動画（30分以上）の処理
    if (durationMinutes > 30) {
      // ファイルサイズが大きい場合は高品質を維持
      if (sizeMB > 3000) {
        return 'web_2k'; // 非常に大きな長時間動画は2Kで高品質維持
      } else if (sizeMB > 1500) {
        return 'web_1080p'; // 大きな長時間動画は1080pで品質維持
      } else {
        return 'web_720p'; // 中程度の長時間動画は720pで軽量化
      }
    }

    // 通常の動画
    if (sizeMB > 1000 || durationMinutes > 60) {
      return 'web_2k'; // 大きなファイルは2Kで効率的に
    } else if (sizeMB > 500 || durationMinutes > 30) {
      return 'web_1080p'; // 中程度のファイルは1080p
    } else {
      return 'web_720p'; // 小さなファイルは720pで高速に
    }
  }

  // サムネイル生成専用API
  async generateThumbnail(
    inputFile: string,
    outputPath: string,
    options: {
      timestamp?: number;
      size?: string;
      format?: string;
      quality?: number;
    } = {}
  ): Promise<{
    success: boolean;
    thumbnailPath: string;
    thumbnailSizeMB: number;
    timestamp: number;
    size: string;
    message: string;
  }> {
    try {
      console.log('GPU thumbnail generation request:', {
        inputFile,
        outputPath,
        options
      });

      const response = await this.client.post('/generate-thumbnail', {
        inputFile,
        outputPath,
        timestamp: options.timestamp || 5,
        size: options.size || '1280x720',
        format: options.format || 'webp',
        quality: options.quality || 85
      });

      console.log('GPU thumbnail generation response:', {
        status: response.status,
        data: response.data
      });

      return response.data;
    } catch (error: any) {
      this.handleError(error, 'generate thumbnail');
    }
  }

  // 変換完了後のサムネイル生成（GPUサーバーAPI使用）
  async generateThumbnailAfterTranscode(
    videoId: string,
    originalFilePath: string,
    options: {
      timestamp?: number;
      size?: string;
      format?: string;
      quality?: number;
    } = {}
  ): Promise<{
    success: boolean;
    thumbnailPath: string;
    thumbnailUrl: string;
    thumbnailSizeMB: number;
  }> {
    try {
      // サムネイルファイル名を生成
      const thumbnailFileName = `${videoId}_thumb_${Date.now()}.${options.format || 'webp'}`;
      const thumbnailPath = `/mnt/nas/videos/thumbnails/${thumbnailFileName}`;
      
      // GPUサーバーが理解できるパスに変換
      const nasMountPath = process.env.NAS_VIDEOS_PATH || '/Volumes/videos';
      const gpuMountPath = process.env.GPU_NAS_VIDEOS_PATH || '/mnt/nas/videos';
      const gpuInputFile = originalFilePath.replace(nasMountPath, gpuMountPath);
      
      console.log('Generating thumbnail after transcode:', {
        videoId,
        originalFilePath,
        gpuInputFile,
        thumbnailPath,
        options
      });

      // GPUサーバーのサムネイル生成APIを呼び出し
      console.log('Calling GPU server thumbnail generation API...');
      const result = await this.generateThumbnail(gpuInputFile, thumbnailPath, options);
      console.log('GPU server thumbnail generation result:', result);

      if (result.success) {
        // ローカルパスに変換
        const gpuMountPath = process.env.GPU_NAS_VIDEOS_PATH || '/mnt/nas/videos';
        const nasMountPath = process.env.NAS_VIDEOS_PATH || '/Volumes/videos';
        const localThumbnailPath = thumbnailPath.replace(gpuMountPath, nasMountPath);
        const thumbnailUrl = `/videos/thumbnails/${thumbnailFileName}`;

        console.log('Thumbnail generation successful:', {
          localPath: localThumbnailPath,
          url: thumbnailUrl,
          sizeMB: result.thumbnailSizeMB
        });

        return {
          success: true,
          thumbnailPath: localThumbnailPath,
          thumbnailUrl,
          thumbnailSizeMB: result.thumbnailSizeMB
        };
      } else {
        console.error('GPU server thumbnail generation failed:', result);
        throw new Error('Thumbnail generation failed');
      }
    } catch (error: any) {
      console.error('Thumbnail generation after transcode failed:', error);
      return {
        success: false,
        thumbnailPath: '',
        thumbnailUrl: '',
        thumbnailSizeMB: 0
      };
    }
  }

  // uploadsディレクトリの一時ファイルを削除
  async cleanupUploadsFile(inputFile: string): Promise<boolean> {
    try {
      if (!inputFile || !inputFile.includes('/uploads/')) {
        return false;
      }

      console.log('🗑️ uploadsディレクトリの一時ファイルを削除:', inputFile);
      
      // GPUサーバーが理解できるパスに変換
      const nasMountPath = process.env.NAS_VIDEOS_PATH || '/Volumes/videos';
      const gpuMountPath = process.env.GPU_NAS_VIDEOS_PATH || '/mnt/nas/videos';
      const gpuFilePath = inputFile.replace(nasMountPath, gpuMountPath);
      
      const response = await fetch(`${this.baseURL}/cleanup-uploads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: gpuFilePath
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ uploadsディレクトリの一時ファイル削除完了:', result);
        return true;
      } else {
        console.error('❌ uploadsディレクトリの一時ファイル削除失敗:', response.statusText);
        return false;
      }
    } catch (error) {
      console.error('❌ uploadsディレクトリの一時ファイル削除エラー:', error);
      return false;
    }
  }
}

// デフォルトクライアントインスタンス
export const gpuTranscoderClient = new GPUTranscoderClient();

// 簡略化されたジョブ監視ユーティリティクラス
export class JobMonitor {
  private gpuClient: GPUTranscoderClient;
  private activeJobs = new Map<string, NodeJS.Timeout>();

  constructor(gpuClient?: GPUTranscoderClient) {
    this.gpuClient = gpuClient || gpuTranscoderClient;
  }

  startMonitoring(
    jobId: string,
    callbacks: {
      onProgress?: (progress: number) => void;
      onComplete?: (result: TranscodeJob) => void;
      onError?: (error: Error) => void;
    }
  ): void {
    this.gpuClient.watchJob(
      jobId,
      (job) => callbacks.onProgress?.(job.progress),
      (job) => {
        this.stopMonitoring(jobId);
        callbacks.onComplete?.(job);
      },
      (error) => {
        this.stopMonitoring(jobId);
        callbacks.onError?.(error);
      }
    );
  }

  stopMonitoring(jobId: string): void {
    const timeout = this.activeJobs.get(jobId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeJobs.delete(jobId);
    }
  }

  stopAllMonitoring(): void {
    this.activeJobs.forEach((timeout) => clearTimeout(timeout));
    this.activeJobs.clear();
  }

  getActiveJobs(): string[] {
    return Array.from(this.activeJobs.keys());
  }
}

// カスタムエラークラス
export class GPUTranscoderError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: any
  ) {
    super(message);
    this.name = 'GPUTranscoderError';
  }
}

// レスポンス検証用のユーティリティ
export function validateTranscodeResponse(response: any): TranscodeResponse {
  if (!response.success) {
    throw new GPUTranscoderError(
      response.error || '変換リクエストに失敗しました',
      response.statusCode
    );
  }

  return response;
}

export function validateJobStatus(response: any): TranscodeJob {
  if (!response.id) {
    throw new GPUTranscoderError('無効なジョブレスポンスです');
  }

  return response;
} 