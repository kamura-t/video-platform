# API Documentation

## 概要
RTX 4070Ti Complete Video Transcoder APIは、AV1エンコーダーに特化した高性能動画変換システムです。

## 基本情報
- **ベースURL**: `http://localhost:3001`
- **エンコーダー**: AV1 NVENC（RTX 4070Ti）
- **対応形式**: MP4, AVI, MOV, MKV, WMV, WebM
- **並列処理**: 4つの動画を同時変換

## エンドポイント一覧

### 1. 変換依頼
**POST** `/transcode`

動画ファイルの変換を開始します。

**リクエスト例:**
```bash
curl -X POST http://localhost:3001/transcode \
  -H "Content-Type: application/json" \
  -d '{
    "inputFile": "/path/to/input.mp4",
    "outputFile": "/path/to/output.mp4",
    "preset": "auto"
  }'
```

**レスポンス例:**
```json
{
  "success": true,
  "jobId": "123",
  "preset": "web_1080p",
  "autoSelected": true,
  "videoDetails": {
    "resolution": "1920x1080",
    "width": 1920,
    "height": 1080,
    "bitrate": 5000,
    "frameRate": 30,
    "codec": "h264"
  },
  "audioDetails": {
    "codec": "aac",
    "bitrate": 128,
    "sampleRate": 48000,
    "channels": 2
  },
  "duration": 120.5,
  "message": "変換ジョブが追加されました"
}
```

### 2. ファイルアップロード + 変換
**POST** `/upload-and-transcode`

ファイルアップロードと同時に変換を開始します。

**リクエスト例:**
```bash
curl -X POST http://localhost:3001/upload-and-transcode \
  -F "video=@video.mp4" \
  -F "preset=auto" \
  -F "generateThumbnail=true"
```

**レスポンス例:**
```json
{
  "success": true,
  "jobId": "123",
  "inputFile": "/mnt/nas/videos/uploads/temp.mp4",
  "outputFile": "/mnt/nas/videos/converted/123_converted.mp4",
  "preset": "web_1080p",
  "estimatedDuration": 120.5,
  "videoInfo": {
    "width": 1920,
    "height": 1080,
    "duration": 120.5,
    "resolution": "1920x1080",
    "bitrate": 5000,
    "frameRate": 30,
    "codec": "h264"
  },
  "audioInfo": {
    "codec": "aac",
    "bitrate": 128,
    "sampleRate": 48000,
    "channels": 2
  },
  "progressUrl": "/job/123/progress",
  "thumbnailGeneration": true,
  "message": "ファイルアップロードと変換ジョブが開始されました"
}
```

### 3. ジョブ状態確認
**GET** `/job/:id`

ジョブの詳細な状態と進捗を取得します。

**リクエスト例:**
```bash
curl http://localhost:3001/job/123
```

**レスポンス例:**
```json
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

### 4. 進捗取得（軽量版）
**GET** `/job/:id/progress`

軽量な進捗情報を取得します（推奨）。

**リクエスト例:**
```bash
curl http://localhost:3001/job/123/progress
```

**レスポンス例:**
```json
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

### 5. アクティブジョブ一覧
**GET** `/jobs/active`

現在実行中のジョブ一覧を取得します。

**リクエスト例:**
```bash
curl http://localhost:3001/jobs/active
```

**レスポンス例:**
```json
{
  "activeJobs": [
    {
      "id": "123",
      "progress": 45,
      "state": "active",
      "status": "processing",
      "originalName": "video.mp4",
      "preset": "web_1080p",
      "createdAt": 1640995200000,
      "processedOn": 1640995200000,
      "estimatedTimeRemaining": 120,
      "currentTime": 3000
    }
  ],
  "totalActive": 1,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 6. キュー統計
**GET** `/queue/stats`

キューの統計情報を取得します。

**リクエスト例:**
```bash
curl http://localhost:3001/queue/stats
```

**レスポンス例:**
```json
{
  "stats": {
    "waiting": 2,
    "active": 1,
    "completed": 50,
    "failed": 3
  },
  "recentJobs": [...],
  "summary": {
    "totalJobs": 56,
    "completedJobs": 50,
    "totalInputSizeMB": 10240,
    "totalOutputSizeMB": 5120,
    "totalSavedSizeMB": 5120,
    "averageCompressionRate": 50.0,
    "totalProcessingTime": 3600,
    "averageProcessingTime": 72.0
  }
}
```

### 7. システム状態
**GET** `/status`

システムの現在の状態を取得します。

**リクエスト例:**
```bash
curl http://localhost:3001/status
```

**レスポンス例:**
```json
{
  "system": {
    "gpu": {
      "utilization": 75,
      "memoryUsed": 8192,
      "memoryTotal": 12282,
      "temperature": 65,
      "powerDraw": 200,
      "encoderSessions": 2,
      "encoderFps": 30
    },
    "system": {
      "ramUsage": 45.2,
      "tmpfsUsage": 30,
      "loadAverage": 2.5
    }
  },
  "queue": {
    "waiting": 2,
    "active": 1,
    "completed": 50,
    "failed": 3
  },
  "presets": ["web_4k", "web_2k", "web_1080p", "web_720p", "portrait_4k", "portrait_2k", "portrait_1080p", "portrait_720p", "preview"],
  "capacity": {
    "tmpfsUsage": 30,
    "ramUsage": 45.2,
    "gpuUsage": 75,
    "availableForNewJobs": true
  }
}
```

### 8. プリセット一覧
**GET** `/presets`

利用可能なプリセット一覧を取得します。

**リクエスト例:**
```bash
curl http://localhost:3001/presets
```

**レスポンス例:**
```json
{
  "presets": ["web_4k", "web_2k", "web_1080p", "web_720p", "portrait_4k", "portrait_2k", "portrait_1080p", "portrait_720p", "preview"],
  "details": {
    "web_4k": {
      "description": "4K高品質（AV1、長時間動画対応）",
      "videoCodec": "av1_nvenc"
    },
    "web_1080p": {
      "description": "1080p高品質（AV1、長時間動画対応）",
      "videoCodec": "av1_nvenc"
    }
  }
}
```

### 9. サムネイル生成
**POST** `/generate-thumbnail`

動画からサムネイルを生成します。

**リクエスト例:**
```bash
curl -X POST http://localhost:3001/generate-thumbnail \
  -H "Content-Type: application/json" \
  -d '{
    "inputFile": "/path/to/video.mp4",
    "outputPath": "/path/to/thumbnail.webp",
    "timestamp": 5,
    "size": "1280x720",
    "format": "webp"
  }'
```

**レスポンス例:**
```json
{
  "success": true,
  "thumbnailPath": "/path/to/thumbnail.webp",
  "thumbnailSizeMB": 0.125,
  "timestamp": 5,
  "size": "1280x720",
  "format": "webp",
  "message": "サムネイルが正常に生成されました"
}
```

### 10. 履歴取得
**GET** `/history`

変換履歴を取得します。

**リクエスト例:**
```bash
curl "http://localhost:3001/history?limit=10&status=completed"
```

**レスポンス例:**
```json
{
  "jobs": [
    {
      "id": "123",
      "status": "completed",
      "originalName": "video.mp4",
      "preset": "web_1080p",
      "videoCodec": "av1_nvenc",
      "inputSizeMB": 100.5,
      "outputSizeMB": 50.2,
      "processingTime": 120.5,
      "compressionRate": "50.1",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "stats": {
    "totalJobs": 100,
    "completedJobs": 95,
    "failedJobs": 5,
    "totalInputSizeMB": 10240,
    "totalOutputSizeMB": 5120,
    "totalSavedSizeMB": 5120,
    "averageCompressionRate": 50.0,
    "totalProcessingTime": 3600,
    "averageProcessingTime": 72.0
  },
  "lastUpdated": "2024-01-01T00:00:00.000Z",
  "totalJobs": 100
}
```

## 進捗ステータス

### 進捗状態
- `waiting`: キュー待機中
- `starting`: 変換開始中
- `processing`: 変換処理中
- `finalizing`: 最終処理中
- `completed`: 完了
- `failed`: 失敗

### 推定残り時間
- 秒単位で返却
- 進捗が0%または100%の場合は`null`
- 現在の進捗から計算

## エラーレスポンス

### 400 Bad Request
```json
{
  "error": "入力ファイルが見つかりません"
}
```

### 404 Not Found
```json
{
  "error": "ジョブが見つかりません"
}
```

### 429 Too Many Requests
```json
{
  "error": "システムリソースが不足しています。しばらく待ってから再試行してください",
  "tmpfsUsage": 95
}
```

### 500 Internal Server Error
```json
{
  "error": "内部サーバーエラーが発生しました"
}
```

## 使用例

### 1. ファイルアップロードと進捗監視
```javascript
// 1. ファイルアップロード
const uploadResponse = await fetch('/upload-and-transcode', {
  method: 'POST',
  body: formData
});
const { jobId, progressUrl } = await uploadResponse.json();

// 2. 進捗監視
const checkProgress = async () => {
  const response = await fetch(progressUrl);
  const progress = await response.json();
  
  console.log(`進捗: ${progress.progress}%`);
  console.log(`残り時間: ${progress.estimatedTimeRemaining}秒`);
  
  if (progress.state === 'completed') {
    console.log('変換完了！');
    return;
  }
  
  // 1秒後に再チェック
  setTimeout(checkProgress, 1000);
};

checkProgress();
```

### 2. 複数ファイルの一括変換
```javascript
const files = ['video1.mp4', 'video2.mp4', 'video3.mp4'];
const jobs = [];

// 全ファイルをアップロード
for (const file of files) {
  const formData = new FormData();
  formData.append('video', file);
  formData.append('preset', 'auto');
  
  const response = await fetch('/upload-and-transcode', {
    method: 'POST',
    body: formData
  });
  
  const { jobId } = await response.json();
  jobs.push(jobId);
}

// 全ジョブの進捗を監視
const checkAllProgress = async () => {
  const activeJobs = await fetch('/jobs/active').then(r => r.json());
  
  console.log(`アクティブジョブ数: ${activeJobs.totalActive}`);
  
  for (const job of activeJobs.activeJobs) {
    console.log(`ジョブ ${job.id}: ${job.progress}%`);
  }
  
  if (activeJobs.totalActive > 0) {
    setTimeout(checkAllProgress, 2000);
  }
};

checkAllProgress();
```

## 注意事項

1. **ファイルサイズ制限**: 10GBまで
2. **並列処理**: 最大4つのジョブを同時実行
3. **一時ファイル**: `/opt/transcode-temp`に保存
4. **進捗更新**: 5%以上の変化時に更新
5. **GPU使用率**: 75%以上で新規ジョブを制限

## パフォーマンス

- **4K動画**: 1-2倍速
- **1080p動画**: 2-4倍速
- **圧縮率**: H.264より30-50%向上
- **GPU使用率**: 60-80%（最適化済み） 