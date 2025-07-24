# Technical Specification

## 概要

RTX 4070Ti Complete Video Transcoderの技術仕様書です。AV1エンコーダーに特化した高性能動画変換システムの詳細な技術仕様を説明します。

## システムアーキテクチャ

### 全体構成

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client Apps   │    │   Web Frontend  │    │   API Gateway   │
│                 │    │                 │    │                 │
│ - File Upload   │◄──►│ - Progress UI   │◄──►│ - REST API      │
│ - Progress      │    │ - Job Monitor   │    │ - WebSocket     │
│ - Download      │    │ - Status Display│    │ - Rate Limiting │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Job Queue     │    │  FFmpeg Engine  │    │   File Storage  │
│                 │    │                 │    │                 │
│ - Bull Queue    │◄──►│ - AV1 NVENC     │◄──►│ - NAS Storage   │
│ - Concurrency   │    │ - Progress      │    │ - Temp Files    │
│ - Retry Logic   │    │ - Error Handle  │    │ - Thumbnails    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   GPU Monitor   │    │   System Stats  │    │   Log Manager   │
│                 │    │                 │    │                 │
│ - nvidia-smi    │    │ - CPU/RAM Usage │    │ - Winston       │
│ - GPU Usage     │    │ - Disk Usage    │    │ - Log Rotation  │
│ - Temperature   │    │ - Load Average  │    │ - Error Tracking│
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### コンポーネント詳細

#### 1. API Gateway
- **技術**: Express.js
- **機能**: REST API、WebSocket、レート制限
- **ポート**: 3001
- **CORS**: 設定済み

#### 2. Job Queue
- **技術**: Bull Queue (Redis)
- **並列処理**: 4ジョブ同時実行
- **リトライ**: 3回まで自動リトライ
- **バックオフ**: 指数バックオフ

#### 3. FFmpeg Engine
- **技術**: FFmpeg 6.0+
- **エンコーダー**: AV1 NVENC
- **進捗監視**: リアルタイム進捗取得
- **エラーハンドリング**: 詳細エラー情報

#### 4. GPU Monitor
- **技術**: nvidia-smi
- **監視項目**: 使用率、メモリ、温度、電力
- **更新間隔**: 5秒
- **アラート**: 80%以上で警告

## 進捗取得システム

### 進捗監視アーキテクチャ

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   FFmpeg        │    │   Progress      │    │   Bull Queue    │
│   Process       │    │   Parser        │    │                 │
│                 │    │                 │    │                 │
│ - stderr stream │───►│ - Regex parsing │───►│ - Job progress  │
│ - stdout stream │    │ - Time tracking │    │ - State update  │
│ - exit code     │    │ - % calculation │    │ - Event emit    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Endpoint  │    │   WebSocket     │    │   Client        │
│                 │    │                 │    │                 │
│ - /job/:id      │    │ - Real-time     │    │ - Progress UI   │
│ - /job/:id/     │    │ - Updates       │    │ - Status bar    │
│   progress      │    │ - Events        │    │ - ETA display   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 進捗取得の詳細仕様

#### 1. FFmpeg進捗パーサー

```javascript
// 進捗パーサーの正規表現
const progressRegex = /time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/;
const durationRegex = /Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/;

// 進捗計算ロジック
const calculateProgress = (currentTime, totalDuration) => {
  if (!totalDuration) return 0;
  return Math.min(100, Math.round((currentTime / totalDuration) * 100));
};

// 残り時間計算
const calculateETA = (currentTime, totalDuration, startTime) => {
  if (!currentTime || !startTime) return null;
  const elapsed = Date.now() - startTime;
  const rate = currentTime / elapsed;
  const remaining = totalDuration - currentTime;
  return Math.round(remaining / rate / 1000);
};
```

#### 2. 進捗APIエンドポイント

##### 軽量進捗取得API（推奨）
```javascript
// GET /job/:id/progress
{
  "id": "123",
  "progress": 45,
  "state": "active",
  "status": "processing",
  "estimatedTimeRemaining": 120,
  "currentTime": 3000,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

##### 詳細進捗取得API
```javascript
// GET /job/:id
{
  "id": "123",
  "progress": 45,
  "state": "active",
  "data": {
    "inputFile": "/path/to/input.mp4",
    "outputFile": "/path/to/output.mp4",
    "preset": "web_1080p"
  },
  "processedOn": 1640995200000,
  "finishedOn": null,
  "returnvalue": null,
  "progressDetails": {
    "percentage": 45,
    "status": "processing",
    "estimatedTimeRemaining": 120,
    "currentTime": 3000
  }
}
```

#### 3. 進捗状態マシン

```javascript
const progressStates = {
  'waiting': 'キュー待機中',
  'starting': '変換開始中',
  'processing': '変換処理中',
  'finalizing': '最終処理中',
  'completed': '完了',
  'failed': '失敗'
};
```

## エンコーダー仕様

### AV1 NVENC設定

#### 基本設定
```bash
# AV1 NVENC基本パラメータ
-vcodec av1_nvenc
-preset p1
-rc vbr
-cq 22
-maxrate 12M
-bufsize 24M
-gpu 0
```

#### プリセット別設定

##### web_4k (4K高品質)
```bash
ffmpeg -i input.mp4 \
  -c:v av1_nvenc \
  -preset p1 \
  -rc vbr \
  -cq 20 \
  -maxrate 30M \
  -bufsize 60M \
  -vf scale=3840:2160 \
  -c:a libopus \
  -b:a 256k \
  -vbr on \
  -compression_level 10 \
  -movflags +faststart \
  output.mp4
```

##### web_1080p (1080p標準)
```bash
ffmpeg -i input.mp4 \
  -c:v av1_nvenc \
  -preset p1 \
  -rc vbr \
  -cq 22 \
  -maxrate 8M \
  -bufsize 16M \
  -vf scale=1920:1080 \
  -c:a libopus \
  -b:a 256k \
  -vbr on \
  -compression_level 10 \
  -movflags +faststart \
  output.mp4
```

##### web_720p (720p軽量)
```bash
ffmpeg -i input.mp4 \
  -c:v av1_nvenc \
  -preset p1 \
  -rc vbr \
  -cq 24 \
  -maxrate 4M \
  -bufsize 8M \
  -vf scale=1280:720 \
  -c:a libopus \
  -b:a 256k \
  -vbr on \
  -compression_level 10 \
  -movflags +faststart \
  output.mp4
```

### 音声処理仕様

#### 音声コーデック
- **コーデック**: libopus
- **ビットレート**: 256kbps（2ch）、1536kbps（5.1ch）、2048kbps（7.1ch）
- **サンプリングレート**: 48kHz
- **チャンネル**: 2ch（ステレオ）、6ch（5.1ch）、8ch（7.1ch）

#### 音声品質分析
```javascript
const analyzeAudio = async (inputFile) => {
  const command = `ffprobe -v quiet -print_format json -show_streams -select_streams a:0 ${inputFile}`;
  const result = await execAsync(command);
  const audioInfo = JSON.parse(result.stdout).streams[0];
  
  // チャンネル数に基づくビットレート決定
  let maxBitrate;
  if (audioInfo.channels >= 7) {
    maxBitrate = 2048; // 7.1ch以上
  } else if (audioInfo.channels >= 5) {
    maxBitrate = 1536; // 5.1ch
  } else {
    maxBitrate = 256;  // 2ch以下
  }
  
  return {
    codec: audioInfo.codec_name,
    bitrate: parseInt(audioInfo.bit_rate) / 1000,
    maxBitrate: maxBitrate,
    sampleRate: audioInfo.sample_rate,
    channels: audioInfo.channels,
    duration: parseFloat(audioInfo.duration)
  };
};
```

## ファイル処理仕様

### ファイルサイズ制限
- **最大ファイルサイズ**: 10GB
- **一時ファイル**: `/opt/transcode-temp`
- **出力ディレクトリ**: `/mnt/nas/videos/converted`
- **サムネイル**: `/mnt/nas/videos/thumbnails`

### サポート形式

#### 入力形式
- **動画**: MP4, AVI, MOV, MKV, WMV, WebM
- **音声**: AAC, MP3, WAV, FLAC
- **画像**: JPG, PNG, WebP

#### 出力形式
- **動画**: MP4 (AV1)
- **音声**: libopus
- **サムネイル**: WebP（デフォルト）

### サムネイル生成仕様

```javascript
const generateThumbnail = async (inputFile, outputPath, options = {}) => {
  const {
    timestamp = 5,
    size = '1280x720',
    format = 'webp',
    quality = 80
  } = options;
  
  const command = `ffmpeg -i ${inputFile} \
    -ss ${timestamp} \
    -vframes 1 \
    -vf scale=${size} \
    -f image2 \
    -q:v ${quality} \
    ${outputPath}`;
    
  await execAsync(command);
};
```

## パフォーマンス仕様

### GPU使用率最適化

#### 目標値
- **通常時**: 60-80%
- **並列処理時**: 70-90%
- **最大値**: 95%（警告レベル）

#### 監視項目
```javascript
const gpuMetrics = {
  utilization: 75,        // GPU使用率（%）
  memoryUsed: 8192,      // 使用メモリ（MB）
  memoryTotal: 12282,    // 総メモリ（MB）
  temperature: 65,        // 温度（℃）
  powerDraw: 200,        // 電力消費（W）
  encoderSessions: 2,    // エンコーダーセッション数
  encoderFps: 30         // エンコーダーFPS
};
```

### 処理速度仕様

#### 目標処理速度
| 解像度 | 目標速度 | 測定方法 |
|--------|----------|----------|
| 4K | 1-2倍速 | 変換時間測定 |
| 1080p | 2-4倍速 | 変換時間測定 |
| 720p | 4-8倍速 | 変換時間測定 |

#### 圧縮効率
- **AV1 vs H.264**: 30-50%向上
- **AV1 vs HEVC**: 20-30%向上
- **ファイルサイズ**: 50-70%削減

### メモリ使用量

#### システム要件
- **最小RAM**: 16GB
- **推奨RAM**: 32GB
- **一時ファイル**: 10GB以上

#### メモリ監視
```javascript
const memoryMetrics = {
  ramUsage: 45.2,        // RAM使用率（%）
  tmpfsUsage: 30,        // 一時ファイル使用率（%）
  loadAverage: 2.5       // システム負荷
};
```

## エラーハンドリング

### エラー分類

#### 1. ファイル関連エラー
```javascript
const fileErrors = {
  'FILE_NOT_FOUND': '入力ファイルが見つかりません',
  'FILE_TOO_LARGE': 'ファイルサイズが制限を超えています',
  'UNSUPPORTED_FORMAT': 'サポートされていないファイル形式です',
  'INVALID_PRESET': '無効なプリセットが指定されました'
};
```

#### 2. GPU関連エラー
```javascript
const gpuErrors = {
  'GPU_NOT_AVAILABLE': 'GPUが利用できません',
  'GPU_MEMORY_FULL': 'GPUメモリが不足しています',
  'GPU_OVERHEAT': 'GPU温度が高すぎます',
  'ENCODER_ERROR': 'エンコーダーエラーが発生しました'
};
```

#### 3. システム関連エラー
```javascript
const systemErrors = {
  'QUEUE_FULL': '変換キューが満杯です',
  'DISK_FULL': 'ディスク容量が不足しています',
  'MEMORY_FULL': 'メモリが不足しています',
  'PROCESSING_ERROR': '変換処理中にエラーが発生しました'
};
```

### エラー回復メカニズム

#### 1. 自動リトライ
```javascript
const retryConfig = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000
  },
  removeOnComplete: true,
  removeOnFail: false
};
```

#### 2. フォールバック処理
```javascript
const fallbackPresets = {
  'web_4k': 'web_1080p',
  'web_2k': 'web_1080p',
  'portrait_4k': 'portrait_1080p',
  'portrait_2k': 'portrait_1080p'
};
```

## セキュリティ仕様

### 入力検証

#### ファイル検証
```javascript
const validateFile = (file) => {
  const maxSize = 10 * 1024 * 1024 * 1024; // 10GB
  const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/mkv'];
  
  if (file.size > maxSize) {
    throw new Error('FILE_TOO_LARGE');
  }
  
  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error('UNSUPPORTED_FORMAT');
  }
};
```

#### パス検証
```javascript
const validatePath = (path) => {
  const allowedDirs = ['/mnt/nas/videos', '/opt/transcode-temp'];
  const normalizedPath = path.normalize();
  
  return allowedDirs.some(dir => normalizedPath.startsWith(dir));
};
```

### レート制限

#### API制限
```javascript
const rateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15分
  max: 100, // リクエスト数
  message: 'リクエストが多すぎます。しばらく待ってから再試行してください。'
};
```

#### ファイルアップロード制限
```javascript
const uploadLimit = {
  fileSize: '10gb',
  files: 1,
  timeout: 300000 // 5分
};
```

## 監視とログ

### ログ仕様

#### ログレベル
```javascript
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6
};
```

#### ログフォーマット
```javascript
const logFormat = {
  timestamp: true,
  level: true,
  message: true,
  jobId: true,
  gpuUsage: true,
  processingTime: true
};
```

### 監視メトリクス

#### システムメトリクス
```javascript
const systemMetrics = {
  cpu: {
    usage: 45.2,
    loadAverage: [2.5, 2.3, 2.1]
  },
  memory: {
    total: 32768,
    used: 14745,
    free: 18023
  },
  disk: {
    total: 1000000,
    used: 300000,
    free: 700000
  }
};
```

#### ジョブメトリクス
```javascript
const jobMetrics = {
  totalJobs: 100,
  completedJobs: 95,
  failedJobs: 5,
  averageProcessingTime: 72.0,
  averageCompressionRate: 50.0
};
```

## API仕様

### REST API

#### エンドポイント一覧
| メソッド | エンドポイント | 説明 |
|----------|---------------|------|
| POST | `/transcode` | 変換依頼 |
| POST | `/upload-and-transcode` | ファイルアップロード+変換 |
| GET | `/job/:id` | ジョブ詳細 |
| GET | `/job/:id/progress` | 進捗取得（軽量） |
| GET | `/jobs/active` | アクティブジョブ一覧 |
| GET | `/queue/stats` | キュー統計 |
| GET | `/status` | システム状態 |
| GET | `/presets` | プリセット一覧 |
| POST | `/generate-thumbnail` | サムネイル生成 |
| GET | `/history` | 履歴取得 |

#### レスポンス形式
```javascript
// 成功レスポンス
{
  "success": true,
  "data": {...},
  "message": "処理が完了しました"
}

// エラーレスポンス
{
  "success": false,
  "error": "エラーメッセージ",
  "code": "ERROR_CODE"
}
```

### WebSocket API

#### イベント一覧
```javascript
const wsEvents = {
  'job:progress': '進捗更新',
  'job:completed': 'ジョブ完了',
  'job:failed': 'ジョブ失敗',
  'system:status': 'システム状態更新',
  'queue:update': 'キュー状態更新'
};
```

## 設定仕様

### 環境変数

```bash
# サーバー設定
NODE_ENV=production
PORT=3001

# ファイルパス
UPLOAD_DIR=/mnt/nas/videos/uploads
OUTPUT_DIR=/mnt/nas/videos/converted
THUMBNAIL_DIR=/mnt/nas/videos/thumbnails
TEMP_DIR=/opt/transcode-temp

# GPU設定
GPU_ID=0
MAX_CONCURRENCY=4

# ログ設定
LOG_LEVEL=info
LOG_FILE=/var/log/gpuserver.log
```

### 設定ファイル

```javascript
const config = {
  server: {
    port: process.env.PORT || 3001,
    host: '0.0.0.0',
    cors: {
      origin: ['http://localhost:3000'],
      credentials: true
    }
  },
  queue: {
    name: 'video transcoding',
    concurrency: 4,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  },
  ffmpeg: {
    path: '/usr/bin/ffmpeg',
    threads: 4,
    maxMuxingQueueSize: 1024
  },
  gpu: {
    id: 0,
    maxUtilization: 80,
    maxTemperature: 85
  },
  paths: {
    uploadDir: '/mnt/nas/videos/uploads',
    outputDir: '/mnt/nas/videos/converted',
    thumbnailDir: '/mnt/nas/videos/thumbnails',
    tempDir: '/opt/transcode-temp'
  }
};
```

## パフォーマンス最適化

### GPU最適化

#### 並列処理設定
```javascript
const concurrencyConfig = {
  maxConcurrentJobs: 4,
  gpuUtilizationTarget: 75,
  memoryBuffer: 2048, // MB
  temperatureLimit: 85 // ℃
};
```

#### エンコーダー最適化
```javascript
const encoderOptimization = {
  preset: 'p1',           // 最高品質
  rc: 'vbr',             // 可変ビットレート
  cq: 22,                // 品質設定
  maxrate: '12M',        // 最大ビットレート
  bufsize: '24M',        // バッファサイズ
  gpu: 0                 // GPU ID
};
```

### メモリ最適化

#### 一時ファイル管理
```javascript
const tempFileManagement = {
  cleanupInterval: 3600000, // 1時間
  maxAge: 86400000,        // 24時間
  maxSize: 10737418240     // 10GB
};
```

#### メモリ監視
```javascript
const memoryMonitoring = {
  warningThreshold: 80,    // 警告レベル
  criticalThreshold: 95,   // 危険レベル
  cleanupThreshold: 70     // クリーンアップレベル
};
```

## 拡張性

### 水平スケーリング

#### マルチGPU対応
```javascript
const multiGPUConfig = {
  gpus: [0, 1, 2, 3],
  loadBalancing: 'round-robin',
  failover: true
};
```

#### クラスター対応
```javascript
const clusterConfig = {
  workers: 4,
  sticky: true,
  healthCheck: true
};
```

### 垂直スケーリング

#### リソース増強
```javascript
const resourceScaling = {
  maxConcurrency: 8,      // 並列処理数増加
  memoryLimit: '64gb',     // メモリ制限増加
  tempStorage: '100gb'     // 一時ストレージ増加
};
```

## 将来の拡張

### 計画中の機能

1. **AI品質向上**: 機械学習による自動品質最適化
2. **リアルタイム配信**: WebRTC対応
3. **クラウド統合**: AWS/GCP/Azure対応
4. **マルチフォーマット**: より多くの出力形式対応
5. **バッチ処理**: 大量ファイル一括処理
6. **品質分析**: 自動品質評価機能

### 技術的改善

1. **GPUメモリ最適化**: より効率的なメモリ使用
2. **並列処理強化**: より多くの同時処理
3. **エラー回復強化**: より堅牢なエラーハンドリング
4. **監視強化**: より詳細なメトリクス収集
5. **セキュリティ強化**: より強固なセキュリティ機能 