# RTX 4070Ti Complete Video Transcoder

## 概要

RTX 4070Ti Complete Video Transcoderは、AV1エンコーダーに特化した高性能動画変換システムです。RTX 4070TiのGPUパワーを最大限に活用し、高品質かつ効率的な動画変換を実現します。

## 🚀 主な特徴

### 🎯 AV1エンコーダー特化
- **唯一のエンコーダー**: AV1 NVENC（長時間動画でも安定）
- **高圧縮効率**: H.264より30-50%向上
- **品質最適化**: 動画特性に基づく自動プリセット選択

### ⚡ 高性能処理
- **並列処理**: 4つの動画を同時変換
- **GPU使用率**: 60-80%の最適化
- **処理速度**: 4K動画で1-2倍速、1080p動画で2-4倍速

### 📊 リアルタイム進捗監視
- **軽量進捗API**: `/job/:id/progress`（推奨）
- **詳細進捗情報**: 推定残り時間、現在の処理段階
- **WebSocket対応**: リアルタイム更新

### 🎵 音声品質分析
- **自動音声分析**: ビットレート、サンプリングレート、チャンネル数
- **品質メトリクス**: SNR、動的範囲、周波数分析
- **最適化**: 音声特性に基づく自動ビットレート調整

### 🖼️ サムネイル生成
- **WebP対応**: 高品質・高圧縮率
- **自動生成**: 変換と同時にサムネイル生成
- **カスタマイズ**: サイズ、形式、品質の調整可能

## 📋 システム要件

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

## 🛠️ インストール

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

## 🚀 起動

### サーバーの起動

```bash
# 開発モード
npm start

# 本番モード
NODE_ENV=production npm start
```

### 動作確認

```bash
# サーバーの状態確認
curl http://localhost:3001/status

# プリセット一覧の確認
curl http://localhost:3001/presets
```

## 📖 使用方法

### 1. ファイルアップロードと変換

```bash
# 基本的なアップロードと変換
curl -X POST http://localhost:3001/upload-and-transcode \
  -F "video=@sample.mp4" \
  -F "preset=auto" \
  -F "generateThumbnail=true"
```

### 2. 進捗監視

```bash
# 軽量な進捗情報を取得（推奨）
curl http://localhost:3001/job/123/progress
```

### 3. JavaScriptでの進捗監視

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

### 4. アクティブジョブの確認

```bash
# 現在実行中のジョブ一覧
curl http://localhost:3001/jobs/active
```

### 5. システム状態の確認

```bash
# システム全体の状態確認
curl http://localhost:3001/status
```

## 🎛️ プリセット

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

## 📊 API エンドポイント

### 主要エンドポイント

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

### 進捗取得API（推奨）

```bash
# 軽量進捗取得
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

## 🔧 設定

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

### パフォーマンス設定

```javascript
const config = {
  queue: {
    concurrency: 4,        // 並列処理数
    attempts: 3,           // リトライ回数
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  },
  gpu: {
    maxUtilization: 80,    // 最大GPU使用率
    maxTemperature: 85     // 最大温度
  },
  ffmpeg: {
    threads: 4,            // CPUスレッド数
    maxMuxingQueueSize: 1024
  }
};
```

## 📈 パフォーマンス

### 処理速度
- **4K動画**: 1-2倍速
- **1080p動画**: 2-4倍速
- **720p動画**: 4-8倍速

### 圧縮効率
- **AV1 vs H.264**: 30-50%向上
- **AV1 vs HEVC**: 20-30%向上
- **ファイルサイズ**: 50-70%削減

### GPU使用率
- **通常時**: 60-80%
- **並列処理時**: 70-90%
- **最大値**: 95%（警告レベル）

## 🔍 トラブルシューティング

### よくある問題

#### 1. GPU使用率が低い
```bash
# GPUドライバーの確認
nvidia-smi

# AV1 NVENCの確認
ffmpeg -encoders | grep av1

# システム状態の確認
curl http://localhost:3001/status
```

#### 2. 進捗が取得できない
```bash
# 軽量進捗APIを使用
curl http://localhost:3001/job/123/progress

# デバッグ情報の確認
curl http://localhost:3001/job/123/debug
```

#### 3. 変換が遅い
- 並列処理数を確認: 最大4つのジョブ
- GPU使用率を確認: 60-80%が最適
- 一時ファイルの容量を確認

#### 4. メモリ不足エラー
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

## 🔒 セキュリティ

### 推奨設定
1. **ファイアウォール**: 特定のIPからのアクセスのみ許可
2. **ファイルサイズ制限**: 10GBまで
3. **一時ファイル**: 定期的なクリーンアップ
4. **ログローテーション**: 適切なログ管理

### レート制限
```javascript
const rateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15分
  max: 100, // リクエスト数
  message: 'リクエストが多すぎます。しばらく待ってから再試行してください。'
};
```

## 🛠️ メンテナンス

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

## 📚 ドキュメント

### 詳細ドキュメント
- [API Documentation](Docs/API_Documentation.md) - 完全なAPI仕様
- [Quick Start Guide](Docs/Quick_Start_Guide.md) - クイックスタートガイド
- [Technical Specification](Docs/Technical_Specification.md) - 技術仕様書
- [Audio Quality Analysis](Docs/Audio_Quality_Analysis.md) - 音声品質分析

### 進捗取得システム
- **軽量進捗API**: `/job/:id/progress`（推奨）
- **詳細進捗API**: `/job/:id`
- **アクティブジョブ**: `/jobs/active`
- **キュー統計**: `/queue/stats`

## 🤝 サポート

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

## 🚀 将来の拡張

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

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 👥 貢献

プルリクエストやイシューの報告を歓迎します。貢献する前に、コーディング規約とコミットメッセージの形式を確認してください。

---

**RTX 4070Ti Complete Video Transcoder** - AV1エンコーダーに特化した高性能動画変換システム 