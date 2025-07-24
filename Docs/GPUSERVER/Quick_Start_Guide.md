# Quick Start Guide

## 概要

RTX 4070Ti Complete Video Transcoderは、AV1エンコーダーに特化した高性能動画変換システムです。このガイドでは、システムの基本的な使用方法を説明します。

## システム要件

### ハードウェア
- **GPU**: NVIDIA RTX 4070Ti（12GB VRAM）
- **RAM**: 32GB以上推奨
- **ストレージ**: 高速SSD（一時ファイル用）
- **ネットワーク**: 1Gbps以上

### ソフトウェア
- **OS**: Ubuntu 22.04 LTS
- **Node.js**: 18.x以上
- **FFmpeg**: 6.0以上（AV1 NVENC対応）
- **NVIDIA Driver**: 535.x以上

## インストール

### 1. 依存関係のインストール

```bash
# システムパッケージの更新
sudo apt update && sudo apt upgrade -y

# FFmpegのインストール（AV1 NVENC対応版）
sudo apt install ffmpeg -y

# Node.jsのインストール
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs -y

# 必要なディレクトリの作成
sudo mkdir -p /opt/transcode-temp
sudo mkdir -p /mnt/nas/videos/{uploads,converted,thumbnails}
sudo chown -R $USER:$USER /opt/transcode-temp
sudo chown -R $USER:$USER /mnt/nas/videos
```

### 2. プロジェクトのセットアップ

```bash
# プロジェクトディレクトリに移動
cd /path/to/gpuserver

# 依存関係のインストール
npm install

# 環境変数の設定
export NODE_ENV=production
export PORT=3001
```

### 3. GPUドライバーの確認

```bash
# NVIDIAドライバーの確認
nvidia-smi

# AV1 NVENCの確認
ffmpeg -encoders | grep av1
```

## 起動

### 1. サーバーの起動

```bash
# 開発モード
npm start

# 本番モード
NODE_ENV=production npm start
```

### 2. 動作確認

```bash
# サーバーの状態確認
curl http://localhost:3001/status

# プリセット一覧の確認
curl http://localhost:3001/presets
```

## 基本的な使用方法

### 1. ファイルアップロードと変換

#### 単一ファイルの変換

```bash
# 基本的なアップロードと変換
curl -X POST http://localhost:3001/upload-and-transcode \
  -F "video=@sample.mp4" \
  -F "preset=auto" \
  -F "generateThumbnail=true"
```

#### レスポンス例

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

### 2. 進捗監視

#### リアルタイム進捗取得

```bash
# 軽量な進捗情報を取得（推奨）
curl http://localhost:3001/job/123/progress
```

#### レスポンス例

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

#### JavaScriptでの進捗監視

```javascript
// 進捗監視の例
const checkProgress = async (jobId) => {
  const response = await fetch(`/job/${jobId}/progress`);
  const progress = await response.json();
  
  console.log(`進捗: ${progress.progress}%`);
  console.log(`残り時間: ${progress.estimatedTimeRemaining}秒`);
  
  if (progress.state === 'completed') {
    console.log('変換完了！');
    return;
  }
  
  // 1秒後に再チェック
  setTimeout(() => checkProgress(jobId), 1000);
};

// 使用例
checkProgress('123');
```

### 3. アクティブジョブの確認

```bash
# 現在実行中のジョブ一覧
curl http://localhost:3001/jobs/active
```

#### レスポンス例

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

### 4. システム状態の確認

```bash
# システム全体の状態確認
curl http://localhost:3001/status
```

#### レスポンス例

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

## プリセットの選択

### 利用可能なプリセット

| プリセット名 | 解像度 | 用途 | エンコーダー |
|-------------|--------|------|-------------|
| `web_4k` | 4K | 高品質 | AV1 |
| `web_2k` | 2K | 高品質 | AV1 |
| `web_1080p` | 1080p | 標準 | AV1 |
| `web_720p` | 720p | 軽量 | AV1 |
| `portrait_4k` | 4K縦型 | 高品質 | AV1 |
| `portrait_2k` | 2K縦型 | 高品質 | AV1 |
| `portrait_1080p` | 1080p縦型 | スマホ | AV1 |
| `portrait_720p` | 720p縦型 | スマホ軽量 | AV1 |
| `preview` | 360p | プレビュー | AV1 |
| `auto` | 自動選択 | 自動最適化 | AV1 |

### プリセット選択のガイドライン

#### 動画の長さによる選択

- **短時間動画（5分未満）**: `web_1080p` または `web_720p`
- **中時間動画（5-30分）**: `web_1080p` または `web_2k`
- **長時間動画（30分以上）**: `web_1080p` または `web_720p`

#### 用途による選択

- **Web配信**: `web_1080p` または `web_720p`
- **高品質保存**: `web_4k` または `web_2k`
- **モバイル配信**: `portrait_1080p` または `portrait_720p`
- **プレビュー**: `preview`

#### 自動選択の使用

```bash
# 動画の特性に基づいて自動的に最適なプリセットを選択
curl -X POST http://localhost:3001/upload-and-transcode \
  -F "video=@sample.mp4" \
  -F "preset=auto"
```

## 高度な使用方法

### 1. 複数ファイルの一括変換

```bash
#!/bin/bash
# 複数ファイルの一括変換スクリプト

files=("video1.mp4" "video2.mp4" "video3.mp4")
jobs=()

for file in "${files[@]}"; do
  echo "アップロード中: $file"
  
  response=$(curl -s -X POST http://localhost:3001/upload-and-transcode \
    -F "video=@$file" \
    -F "preset=auto")
  
  jobId=$(echo $response | jq -r '.jobId')
  jobs+=($jobId)
  
  echo "ジョブID: $jobId"
done

echo "全ジョブが開始されました: ${jobs[@]}"
```

### 2. 進捗監視スクリプト

```bash
#!/bin/bash
# 進捗監視スクリプト

jobId=$1
interval=5

while true; do
  response=$(curl -s http://localhost:3001/job/$jobId/progress)
  progress=$(echo $response | jq -r '.progress')
  state=$(echo $response | jq -r '.state')
  remaining=$(echo $response | jq -r '.estimatedTimeRemaining')
  
  echo "$(date): 進捗 $progress% (残り $remaining 秒)"
  
  if [ "$state" = "completed" ]; then
    echo "変換完了！"
    break
  elif [ "$state" = "failed" ]; then
    echo "変換失敗"
    break
  fi
  
  sleep $interval
done
```

### 3. システム監視

```bash
#!/bin/bash
# システム監視スクリプト

while true; do
  echo "=== システム状態 ==="
  curl -s http://localhost:3001/status | jq '.'
  
  echo "=== アクティブジョブ ==="
  curl -s http://localhost:3001/jobs/active | jq '.'
  
  echo "=== キュー統計 ==="
  curl -s http://localhost:3001/queue/stats | jq '.'
  
  sleep 30
done
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. GPU使用率が低い

**症状**: GPU使用率が30%以下

**解決方法**:
```bash
# GPUドライバーの確認
nvidia-smi

# AV1 NVENCの確認
ffmpeg -encoders | grep av1

# システム状態の確認
curl http://localhost:3001/status
```

#### 2. 変換が遅い

**症状**: 処理速度が期待より遅い

**解決方法**:
- 並列処理数を確認: 最大4つのジョブ
- GPU使用率を確認: 60-80%が最適
- 一時ファイルの容量を確認

#### 3. 進捗が取得できない

**症状**: 進捗APIが正しく動作しない

**解決方法**:
```bash
# 軽量進捗APIを使用
curl http://localhost:3001/job/123/progress

# デバッグ情報の確認
curl http://localhost:3001/job/123/debug
```

#### 4. メモリ不足エラー

**症状**: 変換中にメモリ不足でエラー

**解決方法**:
- 並列処理数を減らす
- 一時ファイルの容量を確認
- システムメモリの使用状況を確認

### ログの確認

```bash
# サーバーログの確認
tail -f /var/log/gpuserver.log

# GPU状態の確認
watch -n 1 nvidia-smi

# システムリソースの確認
htop
```

## パフォーマンス最適化

### 推奨設定

1. **並列処理数**: 4（デフォルト）
2. **GPU使用率**: 60-80%
3. **一時ファイル**: `/opt/transcode-temp`
4. **進捗更新間隔**: 5%以上の変化時

### パフォーマンス指標

- **4K動画**: 1-2倍速
- **1080p動画**: 2-4倍速
- **圧縮率**: H.264より30-50%向上
- **GPU使用率**: 60-80%（最適化済み）

## セキュリティ

### 推奨設定

1. **ファイアウォール**: 特定のIPからのアクセスのみ許可
2. **ファイルサイズ制限**: 10GBまで
3. **一時ファイル**: 定期的なクリーンアップ
4. **ログローテーション**: 適切なログ管理

## メンテナンス

### 定期メンテナンス

```bash
# 一時ファイルのクリーンアップ
sudo rm -rf /opt/transcode-temp/*

# ログファイルのローテーション
sudo logrotate /etc/logrotate.d/gpuserver

# システムの再起動
sudo systemctl restart gpuserver
```

### バックアップ

```bash
# 設定ファイルのバックアップ
cp server-complete.js /backup/

# 変換履歴のバックアップ
cp /path/to/history.json /backup/
```

## サポート

### ログの収集

問題が発生した場合は、以下の情報を収集してください：

```bash
# システム情報
uname -a
nvidia-smi
df -h
free -h

# サーバー状態
curl http://localhost:3001/status

# ログファイル
tail -n 100 /var/log/gpuserver.log
```

### よくある質問

**Q: AV1エンコーダーが使用されない**
A: NVIDIAドライバーとFFmpegのバージョンを確認してください。

**Q: 進捗が正しく表示されない**
A: 軽量進捗API（`/job/:id/progress`）を使用してください。

**Q: GPU使用率が低い**
A: 並列処理数とGPUドライバーを確認してください。

**Q: 変換が失敗する**
A: ファイル形式とサイズを確認し、ログを確認してください。 