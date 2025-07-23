# GVA Video Platform

組織向け動画投稿・公開プラットフォーム

## 概要

このプロジェクトは、組織内での動画コンテンツの効率的な管理・共有を可能にする専用プラットフォームです。GPU加速による高性能な動画トランスコーディング、リアルタイム分析、多階層認証システムを備えた企業グレードのビデオ管理システムです。

## 主要機能

- 🎥 **動画投稿・管理** - ファイルアップロード、YouTube連携、GPU加速AV1トランスコーディング
- 📝 **プレイリスト作成・管理** - カテゴリベースの組織化、ドラッグ&ドロップ管理
- 🔍 **高度な検索・フィルタリング** - 無限スクロール、リアルタイム検索、カテゴリ・タグフィルター
- 👥 **多階層ユーザー管理** - 管理者・キュレーター・視聴者権限、プロフィール管理
- 📊 **レコメンド機能** - 視聴履歴ベースの推薦システム
- 🌐 **多言語対応** - Google Translate API統合
- 📱 **レスポンシブデザイン** - モバイルファースト設計
- ⏰ **予約投稿** - スケジュール機能付き動画公開
- 📈 **分析・統計** - 視聴回数、トレンド分析、ダッシュボード
- 🎨 **カスタマイズ** - テーマ切替、ロゴ設定、組織設定

## 技術スタック

### フロントエンド
- **フレームワーク**: Next.js 15 (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **UIコンポーネント**: Shadcn/ui (Radix UI)
- **状態管理**: Zustand + Context Providers
- **フォーム**: React Hook Form + Zod
- **アニメーション**: Tailwind CSS Animate
- **テーマ**: next-themes (ダーク/ライトモード)

### バックエンド
- **データベース**: PostgreSQL
- **ORM**: Prisma
- **認証**: JWT + Cookie ベースセッション
- **ファイル処理**: Sharp, Formidable
- **API**: Next.js API Routes
- **バリデーション**: Zod

### インフラストラクチャ
- **動画処理**: GPU トランスコーディングサーバー (AV1 NVENC)
- **ストレージ**: NAS統合
- **キャッシュ**: Redis
- **認証**: bcryptjs

## 開発環境のセットアップ

### 前提条件

- Node.js 18.17以上
- PostgreSQL 14以上
- Redis 6以上
- GPU トランスコーディングサーバー (オプション)

### インストール

1. リポジトリのクローン
```bash
git clone <repository-url>
cd video-platform
```

2. 依存関係のインストール
```bash
npm install
```

3. 環境変数の設定
```bash
cp env.example .env.local
```

`.env.local`ファイルを編集して、必要な環境変数を設定してください。

4. データベースのセットアップ
```bash
# PostgreSQLデータベースの作成
createdb gva_video_platform

# Prismaクライアントの生成とデータベース同期
npm run db:generate
npm run db:push

# 初期データの投入
npm run db:seed
```

5. 開発サーバーの起動
```bash
npm run dev
```

http://localhost:3000 でアプリケーションにアクセスできます。

## 開発コマンド

### 基本コマンド
```bash
# 開発サーバーの起動
npm run dev

# ビルド
npm run build

# 本番サーバーの起動
npm start

# コード品質チェック
npm run lint                # ESLint
npm run type-check          # TypeScript型チェック
```

### データベース操作
```bash
# Prismaクライアント生成
npm run db:generate

# データベーススキーマの同期
npm run db:push

# データベースの初期データ投入
npm run db:seed

# Prisma Studioの起動
npm run db:studio

# データベースのリセット
npm run db:reset
```

### スクリプト
```bash
# 予約投稿の実行
npm run publish-scheduled
```

## プロジェクト構成

```
video-platform/
├── app/                    # Next.js 15 App Router
│   ├── api/                # API Routes
│   │   ├── admin/          # 管理者用API
│   │   ├── auth/           # 認証 API
│   │   ├── videos/         # 動画管理API
│   │   ├── upload/         # ファイルアップロードAPI
│   │   ├── transcode/      # トランスコーディングAPI
│   │   └── playlists/      # プレイリストAPI
│   ├── admin/              # 管理者ページ
│   ├── watch/              # 動画視聴ページ
│   ├── upload/             # 動画アップロードページ
│   └── playlists/          # プレイリストページ
├── components/             # Reactコンポーネント
│   ├── admin/              # 管理者用コンポーネント
│   ├── auth/               # 認証関連コンポーネント
│   ├── layout/             # レイアウトコンポーネント
│   ├── playlist/           # プレイリスト関連
│   ├── providers/          # Contextプロバイダー
│   ├── ui/                 # Shadcn/uiコンポーネント
│   ├── upload/             # アップロード機能
│   ├── user/               # ユーザー関連コンポーネント
│   └── video/              # 動画関連コンポーネント
├── hooks/                  # カスタムReactフック
├── lib/                    # ユーティリティ関数
│   ├── auth.ts             # 認証ユーティリティ
│   ├── prisma.ts           # Prismaクライアント
│   ├── gpu-transcoder.ts   # GPUトランスコーディング
│   └── recommendations.ts  # 推薦システム
├── prisma/                 # Prismaスキーマ・マイグレーション
│   ├── schema.prisma       # データベーススキーマ
│   └── migrations/         # データベースマイグレーション
├── scripts/                # ユーティリティスクリプト
├── types/                  # TypeScript型定義
├── public/                 # 静的ファイル
│   └── uploads/            # アップロードファイル
└── Docs/                   # プロジェクト仕様書
    ├── 要件定義書v2.1.md
    ├── 仕様書v2.0.md
    ├── データベース設計書v11.md
    ├── API設計書v3.md
    └── GPUSERVER/          # GPUサーバードキュメント
```

## 主要機能の実装状況

### ✅ 実装完了
- **認証システム** - JWT + Cookie認証、多階層権限管理（管理者・キュレーター・視聴者）
- **動画管理** - ファイルアップロード、YouTube連携、GPU加速トランスコーディング
- **コンテンツ組織化** - カテゴリ・タグ管理、ドラッグ&ドロップ並び替え
- **プレイリスト機能** - 作成・編集・共有、動画順序管理
- **検索・フィルター** - 高度な検索、無限スクロール、リアルタイムフィルタリング
- **レスポンシブUI** - モバイルファーストデザイン、ダーク/ライトテーマ
- **管理機能** - ユーザー管理、システム設定、統計ダッシュボード
- **予約投稿** - スケジュール機能付き動画公開
- **分析機能** - 視聴統計、トレンド分析、レコメンドシステム

### 🔄 継続開発中
- **高度な分析** - より詳細な視聴パターン分析
- **API拡張** - サードパーティ統合
- **パフォーマンス最適化** - キャッシュ戦略の改善
- **多言語対応** - UI/UXの国際化対応

## アーキテクチャの特徴

### GPU加速トランスコーディング
- **AV1 NVENC**: 最新のハードウェアエンコーディング
- **並列処理**: 最大4並列の同時トランスコーディング
- **リアルタイム監視**: 進捗追跡とジョブ管理
- **品質分析**: 自動品質評価とビットレート最適化

### スケーラブルアーキテクチャ
- **マイクロサービス設計**: 疎結合なコンポーネント構成
- **データベース最適化**: 戦略的インデックス配置
- **NAS統合**: スケーラブルなファイルストレージ
- **Redis キャッシュ**: 高速なデータアクセス

### セキュリティ
- **IPアクセス制御**: プライベートネットワーク制限
- **レート制限**: API使用量制限
- **コンテンツセキュリティ**: XSS保護
- **ファイル検証**: アップロード時の安全性チェック

## 環境変数設定

`.env.local`ファイルで以下の環境変数を設定してください：

```bash
# データベース
DATABASE_URL="postgresql://user:password@localhost:5432/gva_video"
REDIS_URL="redis://localhost:6379"

# 認証
JWT_SECRET="your-jwt-secret"
SESSION_SECRET="your-session-secret"

# GPU トランスコーディングサーバー
GPU_SERVER_URL="http://172.16.1.172:3001"
NAS_BASE_URL="http://172.16.2.7"

# ファイルストレージ
UPLOAD_DIR="/path/to/uploads"
MAX_FILE_SIZE="10737418240"  # 10GB

# 外部サービス
YOUTUBE_API_KEY="your-youtube-api-key"
GOOGLE_TRANSLATE_API_KEY="your-google-translate-key"
```

## トラブルシューティング

### よくある問題
- **データベース接続エラー**: PostgreSQLサービスの起動状況を確認
- **GPUサーバー接続失敗**: サーバーアクセシビリティとNVENCサポートを確認
- **ファイルアップロード失敗**: アップロード制限とディスク容量を確認
- **認証エラー**: JWTシークレットとセッション設定を確認

### パフォーマンス問題
- **クエリ処理が遅い**: データベースインデックスとクエリ最適化を確認
- **メモリ使用量**: トランスコーディングジョブキューを監視
- **ネットワーク遅延**: 適切なキャッシュ戦略を実装

## 貢献

プロジェクトへの貢献は歓迎します。開発前に仕様書（`Docs/`フォルダ）を確認してください。

## ライセンス

このプロジェクトは組織内での使用を想定したエンタープライズ向けビデオ管理システムです。
