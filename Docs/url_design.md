# URL設計書（実装版 v2.1）

**最終更新**: 2025年7月15日  
**バージョン**: 2.1  
**更新者**: 開発チーム

## 1. URL設計方針

### 1.1 設計原則
- **統一性**: 単一動画・プレイリストを同じURL形式で管理
- **短縮性**: 覚えやすく、共有しやすい短いURL
- **SEO対応**: 検索エンジンフレンドリーな構造
- **推測困難性**: video_id/post_idの推測防止
- **階層性**: 論理的で直感的なURL階層
- **パフォーマンス最適化**: サーバーサイドフィルタリングとグローバル状態管理による高速レスポンス

### 1.2 基本構造
```
https://video.example.com/{category}/{identifier}
```

## 2. 実装済みURL

### 2.1 メインページ
```
GET /                                # トップページ（動画一覧）
```

#### フィルタリング機能
- **カテゴリフィルター**: `/?category={slug}` (例: `/?category=technology`)
- **タグフィルター**: `/?tag={tag_name}` (例: `/?tag=初心者向け`)
- **検索クエリ**: `/?q={search_query}` (例: `/?q=React`)
- **ソート**: `/?sort={sort_type}` (例: `/?sort=popular`)

#### 実装例
```
/                                    # 全動画一覧
/?category=technology               # テクノロジーカテゴリ
/?category=programming             # プログラミングカテゴリ
/?tag=初心者向け                    # 初心者向けタグ
/?q=React                          # React検索
/?category=technology&sort=popular # テクノロジー人気順
```

### 2.2 動画・プレイリスト視聴（統合）
```
GET /watch/{post_id}                 # 動画・プレイリスト統合視聴ページ
```

#### 実装例
```
/watch/dQw4w9WgXcQ                  # 単一動画
/watch/PLrAXdxdAX                   # プレイリスト
```

#### 実装詳細
- **post_id**: 11文字のYouTube形式ID
- **コンテンツ判別**: Posts.post_typeで動画/プレイリスト判定
- **アクセス制御**: Posts.visibilityとIPアドレスで制御
- **メタデータ**: OpenGraph対応、SEO最適化

### 2.3 認証関連
```
GET /login                          # ログインページ
POST /login                         # ログイン処理（フォーム送信）
```

### 2.4 アップロード
```
GET /upload                         # アップロードページ
```

### 2.5 タグページ
```
GET /tags                           # タグ一覧ページ
```

## 3. 管理画面URL（実装済み）

### 3.1 管理トップ
```
GET /admin                          # 管理画面ダッシュボード
```

### 3.2 動画管理
```
GET /admin/videos                   # 動画一覧・管理ページ
GET /admin/videos/{id}/edit         # 動画編集ページ
```

### 3.3 ユーザー管理
```
GET /admin/users                    # ユーザー一覧・管理ページ
GET /admin/users/create             # ユーザー作成ページ
```

### 3.4 カテゴリ・タグ管理
```
GET /admin/categories               # カテゴリ管理ページ
```

### 3.5 システム設定
```
GET /admin/settings                 # システム設定ページ
```

### 3.6 その他管理機能
```
GET /admin/analytics                # 分析ページ
GET /admin/deleted-files            # 削除済みファイル一覧
```

## 4. API エンドポイント（実装済み・最適化版）

### 4.1 認証API
```
POST /api/auth/login                # ログイン
POST /api/auth/logout               # ログアウト
GET /api/auth/me                    # ユーザー情報取得
```

### 4.2 動画API（最適化版）
```
GET /api/videos                     # 動画一覧取得（サーバーサイドフィルタリング）
GET /api/videos/{id}                # 動画詳細取得
```

#### パラメータ（最適化版）
- `page`: ページ番号（デフォルト: 1）
- `limit`: 取得件数（デフォルト: 20）
- `sort`: ソート方式（latest, popular, duration, oldest, title）
- `category`: カテゴリフィルタ（slug形式）
- `tags`: タグフィルタ（カンマ区切り）
- `q`: 検索クエリ
- `uploader`: アップロード者フィルタ
- `includePrivate`: 非公開動画を含める（管理者のみ）
- `random`: ランダム取得（true/false）

#### パフォーマンス改善
- **サーバーサイドフィルタリング**: データベースレベルでの効率的なフィルタリング
- **グローバル状態管理**: SettingsProvider・CategoriesProviderによる重複APIコール削除
- **レスポンス時間**: 平均20-30ms（従来の900msから大幅改善）
- **ネットワーク負荷削減**: 必要なデータのみを転送
- **API重複呼び出し削減**: 複数コンポーネントでの同一API重複呼び出しを解消

### 4.3 投稿API
```
GET /api/posts/{post_id}            # 投稿詳細取得
```

### 4.4 アップロードAPI
```
POST /api/upload                    # 動画アップロード（YouTube URL・ファイル両対応）
```

### 4.5 カテゴリAPI
```
GET /api/categories                 # カテゴリ一覧取得
```

### 4.6 タグAPI（最適化版）
```
GET /api/tags                       # タグ一覧取得（slugフィールド削除）
POST /api/tags                      # タグ作成（nameのみ）
PUT /api/tags                       # タグ更新（nameのみ）
DELETE /api/tags                    # タグ削除
```

#### タグシステムの最適化
- **slugフィールド削除**: 日本語タグの問題を解決
- **nameフィールドのみ使用**: シンプルで直感的な構造
- **URLパラメータ**: `/?tag=タグ名` 形式で直接使用
- **重複APIコール削減**: グローバル状態管理による効率化

### 4.7 管理者API
```
GET /api/admin/categories           # 管理者用カテゴリ一覧
GET /api/admin/settings             # システム設定取得
PUT /api/admin/settings             # システム設定更新
GET /api/admin/users                # ユーザー一覧取得
POST /api/admin/update-durations    # 動画時間一括更新
GET /api/admin/stats                # 統計情報取得
```

### 4.8 YouTube連携API
```
POST /api/youtube/metadata          # YouTube動画メタデータ取得
```

### 4.9 視聴進捗API
```
POST /api/videos/{id}/view-progress # 視聴進捗記録
```

## 5. 静的ファイル配信

### 5.1 アップロードファイル
```
GET /videos/original/{filename}     # 元動画ファイル配信
GET /videos/converted/{filename}    # 変換済み動画ファイル配信
GET /videos/thumbnails/{filename}   # サムネイル画像配信（WebP形式）
```

### 5.2 デフォルト画像
```
GET /images/default-avatar.png      # デフォルトアバター
GET /images/default-thumbnail.jpg   # デフォルトサムネイル
```

### 5.3 アップロードファイル
```
GET /uploads/avatars/{filename}     # ユーザーアバター
GET /uploads/logos/{filename} # ロゴ画像
```

## 6. Next.js App Router構造（実装済み・最適化版）

### 6.1 ページ構造
```
app/
├── page.tsx                        # / (トップページ・最適化版)
├── layout.tsx                      # ルートレイアウト
├── globals.css                     # グローバルスタイル
├── login/
│   └── page.tsx                    # /login
├── watch/
│   └── [post_id]/
│       └── page.tsx                # /watch/{post_id}
├── upload/
│   ├── page.tsx                    # /upload
│   └── complete/
│       └── page.tsx                # /upload/complete
├── tags/
│   └── page.tsx                    # /tags
├── settings/
│   └── page.tsx                    # /settings
├── playlists/
│   ├── page.tsx                    # /playlists
│   └── create/
│       └── page.tsx                # /playlists/create
├── user/
│   └── [id]/
│       └── page.tsx                # /user/{id}
├── [username]/
│   └── page.tsx                    # /{username}
└── admin/
    ├── page.tsx                    # /admin
    ├── videos/
    │   ├── page.tsx                # /admin/videos
    │   └── [id]/
    │       └── edit/
    │           ├── page.tsx        # /admin/videos/{id}/edit
    │           └── video-edit-client.tsx
    ├── users/
    │   ├── page.tsx                # /admin/users
    │   └── create/
    │       └── page.tsx            # /admin/users/create
    ├── categories/
    │   └── page.tsx                # /admin/categories
    ├── settings/
    │   └── page.tsx                # /admin/settings
    ├── analytics/
    │   └── page.tsx                # /admin/analytics
    └── deleted-files/
        └── page.tsx                # /admin/deleted-files
```

### 6.2 API構造（最適化版）
```
app/api/
├── auth/
│   ├── login/route.ts              # POST /api/auth/login
│   ├── logout/route.ts             # POST /api/auth/logout
│   └── me/route.ts                 # GET /api/auth/me
├── videos/
│   ├── route.ts                    # GET /api/videos（最適化版）
│   ├── [id]/
│   │   ├── route.ts                # GET /api/videos/{id}
│   │   └── view-progress/
│   │       └── route.ts            # POST /api/videos/{id}/view-progress
│   └── [...path]/
│       └── route.ts                # 動画ファイル配信
├── posts/
│   └── [post_id]/
│       └── route.ts                # GET /api/posts/{post_id}
├── categories/
│   └── route.ts                    # GET /api/categories
├── tags/
│   └── route.ts                    # GET/POST/PUT/DELETE /api/tags（最適化版）
├── upload/
│   └── route.ts                    # POST /api/upload
├── settings/
│   ├── route.ts                    # GET/PUT /api/settings
│   └── public/
│       └── route.ts                # GET /api/settings/public
├── user/
│   ├── avatar/
│   │   └── route.ts                # POST /api/user/avatar
│   └── profile/
│       └── route.ts                # PUT /api/user/profile
├── users/
│   └── [id]/
│       ├── videos/
│       │   └── route.ts            # GET /api/users/{id}/videos
│       ├── playlists/
│       │   └── route.ts            # GET /api/users/{id}/playlists
│       └── redirect/
│           └── route.ts            # GET /api/users/{id}/redirect
├── playlists/
│   └── [id]/
│       └── route.ts                # GET /api/playlists/{id}
├── admin/
│   ├── categories/
│   │   ├── route.ts                # GET /api/admin/categories
│   │   └── reorder/
│   │       └── route.ts            # POST /api/admin/categories/reorder
│   ├── users/
│   │   ├── route.ts                # GET /api/admin/users
│   │   └── [id]/
│   │       ├── avatar/
│   │       │   └── route.ts        # POST /api/admin/users/{id}/avatar
│   │       └── transfer/
│   │           └── route.ts        # POST /api/admin/users/{id}/transfer
│   ├── videos/
│   │   └── [id]/
│   │       ├── route.ts            # PUT/DELETE /api/admin/videos/{id}
│   │       └── generate-thumbnail/
│   │           └── route.ts        # POST /api/admin/videos/{id}/generate-thumbnail
│   ├── settings/
│   │   ├── route.ts                # GET/PUT /api/admin/settings
│   │   ├── init/
│   │   │   └── route.ts            # POST /api/admin/settings/init
│   │   └── logo/
│   │       └── route.ts            # POST /api/admin/settings/logo
│   ├── stats/
│   │   └── route.ts                # GET /api/admin/stats
│   └── update-durations/
│       └── route.ts                # POST /api/admin/update-durations
├── youtube/
│   └── metadata/
│       └── route.ts                # POST /api/youtube/metadata
├── transcode/
│   ├── status/
│   │   └── route.ts                # GET /api/transcode/status
│   └── job/
│       └── [jobId]/
│           ├── route.ts             # GET /api/transcode/job/{jobId}
│           ├── cancel/
│           │   └── route.ts         # POST /api/transcode/job/{jobId}/cancel
│           └── video/
│               └── route.ts         # GET /api/transcode/job/{jobId}/video
└── placeholder/
    └── [...dimensions]/
        └── route.ts                 # GET /api/placeholder/{width}x{height}
```

## 7. パフォーマンス最適化（v2.1新機能）

### 7.1 サーバーサイドフィルタリング
- **カテゴリフィルター**: データベースレベルでの効率的なフィルタリング
- **レスポンス時間**: 平均20-30ms（従来の900msから大幅改善）
- **ネットワーク負荷削減**: 必要なデータのみを転送

### 7.2 グローバル状態管理（v2.1新機能）
- **SettingsProvider**: サイト設定の一元管理
- **CategoriesProvider**: カテゴリの一元管理
- **重複APIコール削減**: 複数コンポーネントでの同一API重複呼び出しを解消
- **メモリ使用量削減**: 不要な再レンダリングの防止

### 7.3 タグシステム最適化
- **slugフィールド削除**: 日本語タグの問題を解決
- **nameフィールドのみ使用**: シンプルで直感的な構造
- **URLパラメータ**: `/?tag=タグ名` 形式で直接使用

### 7.4 キャッシュ戦略
- **APIレスポンス**: 同一クエリの高速応答
- **静的ファイル**: WebP形式のサムネイル最適化
- **データベース**: インデックス最適化

## 8. セキュリティ対策

### 8.1 アクセス制御
- **IPアドレス制限**: プライベート動画のアクセス制御
- **認証システム**: JWTトークンベースの認証
- **権限管理**: 管理者・キュレーター・一般ユーザーの権限分離

### 8.2 ファイルアップロード
- **ファイル形式制限**: 動画ファイルのみ許可
- **サイズ制限**: 最大5GBまで対応
- **ウイルススキャン**: アップロード時の安全性確保

## 9. 今後の拡張予定

### 9.1 機能拡張
- **プレイリスト機能**: 動画のグループ化
- **コメント機能**: 動画へのコメント投稿
- **いいね機能**: 動画の評価システム

### 9.2 パフォーマンス向上
- **CDN連携**: 静的ファイルの配信最適化
- **データベース最適化**: クエリパフォーマンスの向上
- **キャッシュ戦略**: Redis等の導入検討
- **状態管理最適化**: さらなるグローバル状態管理の拡張

### 9.3 モバイル対応
- **レスポンシブデザイン**: モバイルデバイス対応
- **PWA対応**: プログレッシブウェブアプリ化
- **オフライン対応**: オフライン視聴機能

## 10. 最適化実績（v2.1）

### 10.1 API重複呼び出し削減
- **SettingsProvider導入**: `/api/settings/public`の重複呼び出しを解消
- **CategoriesProvider導入**: `/api/categories`の重複呼び出しを解消
- **フロントエンドフィルタリング削除**: サーバーサイドフィルタリングに完全移行

### 10.2 パフォーマンス改善実績
- **初期ロード時間**: 大幅短縮
- **フィルター操作応答性**: 即座のレスポンス
- **メモリ使用量**: 不要な再レンダリング削減により削減
- **ネットワーク負荷**: 重複APIコール削減により大幅軽減

### 10.3 実装された最適化技術
- **React Context API**: グローバル状態管理
- **useEffect最適化**: 依存配列の適切な設定
- **サーバーサイドフィルタリング**: データベースレベルでの効率的な処理
- **コンポーネント設計**: 重複処理の排除