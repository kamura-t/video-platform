# API設計書

## 1. API設計方針

### 1.1 基本原則
- **RESTful設計**: HTTP動詞とリソース指向
- **統一性**: 一貫したレスポンス形式
- **バージョニング**: `/api/v1/` プレフィックス
- **認証**: JWT または セッションベース
- **エラーハンドリング**: 標準的なHTTPステータスコード

### 1.2 ベースURL
```
https://video.example.com/api/v1
```

### 1.3 共通レスポンス形式
```json
{
  "success": true,
  "data": {},
  "message": "",
  "timestamp": "2025-06-03T10:00:00Z",
  "version": "v1"
}
```

### 1.4 エラーレスポンス形式
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "title",
        "message": "Title is required"
      }
    ]
  },
  "timestamp": "2025-06-03T10:00:00Z"
}
```

## 2. 認証API

### 2.1 ログイン
```http
POST /api/v1/auth/login
```

#### リクエスト
```json
{
  "username": "admin",
  "password": "password123"
}
```

#### レスポンス（成功）
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "admin",
      "display_name": "管理者",
      "email": "admin@example.com",
      "role": "admin",
      "department": "IT部門",
      "profile_image_url": "/images/admin-avatar.png"
    },
    "expires_at": "2025-06-04T10:00:00Z"
  }
}
```

### 2.2 ログアウト
```http
POST /api/v1/auth/logout
```

### 2.3 トークン更新
```http
POST /api/v1/auth/refresh
```

### 2.4 プロフィール取得
```http
GET /api/v1/auth/profile
```

## 3. 動画API

### 3.1 動画一覧取得
```http
GET /api/v1/videos
```

#### クエリパラメータ
```
?page=1              # ページ番号（デフォルト: 1）
&limit=20            # 1ページあたりの件数（デフォルト: 20）
&sort=latest         # ソート順（latest, popular, duration）
&category=programming # カテゴリフィルター
&tag=javascript      # タグフィルター
&q=React            # 検索キーワード
&visibility=public   # 公開設定（public, private）
&status=completed    # ステータス（processing, completed, failed）
```

#### レスポンス
```json
{
  "success": true,
  "data": {
    "videos": [
      {
        "id": 1,
        "video_id": "dQw4w9WgXcQ",
        "title": "React基礎講座",
        "description": "Reactの基本的な使い方を学びます",
        "upload_type": "file",
        "thumbnail_url": "/thumbnails/2025/06/03/thumb1.jpg",
        "duration": 1800,
        "view_count": 150,
        "visibility": "public",
        "status": "completed",
        "uploader": {
          "id": 2,
          "display_name": "田中講師",
          "profile_image_url": "/images/tanaka-avatar.png"
        },
        "categories": [
          {
            "id": 1,
            "name": "プログラミング",
            "slug": "programming"
          }
        ],
        "tags": [
          {
            "id": 1,
            "name": "React",
            "slug": "react"
          },
          {
            "id": 2,
            "name": "初心者",
            "slug": "beginner"
          }
        ],
        "created_at": "2025-06-03T09:00:00Z",
        "published_at": "2025-06-03T10:00:00Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 15,
      "total_count": 285,
      "per_page": 20,
      "has_next": true,
      "has_prev": false
    }
  }
}
```

### 3.2 動画詳細取得
```http
GET /api/v1/videos/{video_id}
```

#### レスポンス
```json
{
  "success": true,
  "data": {
    "id": 1,
    "video_id": "dQw4w9WgXcQ",
    "title": "React基礎講座",
    "description": "Reactの基本的な使い方を詳しく解説します。\n\n目次:\n1. Reactとは\n2. JSXの書き方\n3. コンポーネントの作成",
    "upload_type": "file",
    "original_filename": "react-basics.mp4",
    "file_size": 524288000,
    "mime_type": "video/mp4",
    "converted_file_path": "/videos/converted/2025/06/03/react-basics-av1.mp4",
    "thumbnail_url": "/thumbnails/2025/06/03/thumb1.jpg",
    "duration": 1800,
    "view_count": 150,
    "visibility": "public",
    "status": "completed",
    "uploader": {
      "id": 2,
      "username": "tanaka",
      "display_name": "田中講師",
      "email": "tanaka@example.com",
      "department": "教育部"
    },
    "categories": [
      {
        "id": 1,
        "name": "プログラミング",
        "slug": "programming",
        "color": "#007bff"
      }
    ],
    "tags": [
      {
        "id": 1,
        "name": "React",
        "slug": "react"
      },
      {
        "id": 2,
        "name": "初心者",
        "slug": "beginner"
      }
    ],
    "created_at": "2025-06-03T09:00:00Z",
    "updated_at": "2025-06-03T09:30:00Z",
    "published_at": "2025-06-03T10:00:00Z"
  }
}
```

### 3.3 動画投稿
```http
POST /api/v1/videos
```

#### リクエスト（ファイルアップロード）
```json
{
  "title": "Vue.js入門講座",
  "description": "Vue.jsの基本的な使い方を学びます",
  "upload_type": "file",
  "file": "base64_encoded_file_data",
  "thumbnail": "base64_encoded_thumbnail_data",
  "visibility": "public",
  "category_ids": [1, 2],
  "tag_names": ["Vue.js", "JavaScript", "初心者"]
}
```

#### リクエスト（YouTube）
```json
{
  "title": "Angular基礎講座",
  "description": "Angularの基本的な使い方を学びます",
  "upload_type": "youtube",
  "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "visibility": "public",
  "category_ids": [1],
  "tag_names": ["Angular", "TypeScript"]
}
```

#### レスポンス
```json
{
  "success": true,
  "data": {
    "id": 2,
    "video_id": "aBc123dEf45",
    "title": "Vue.js入門講座",
    "status": "processing",
    "upload_id": "upload_789xyz"
  }
}
```

### 3.4 動画更新
```http
PUT /api/v1/videos/{video_id}
```

### 3.5 動画削除
```http
DELETE /api/v1/videos/{video_id}
```

## 4. 投稿API（統合管理）

### 4.1 投稿一覧取得
```http
GET /api/v1/posts
```

#### レスポンス
```json
{
  "success": true,
  "data": {
    "posts": [
      {
        "id": 1,
        "post_id": "dQw4w9WgXcQ",
        "title": "React基礎講座",
        "description": "Reactの基本的な使い方を学びます",
        "post_type": "video",
        "visibility": "public",
        "creator": {
          "id": 2,
          "display_name": "田中講師"
        },
        "content": {
          "video_id": "dQw4w9WgXcQ",
          "thumbnail_url": "/thumbnails/2025/06/03/thumb1.jpg",
          "duration": 1800,
          "view_count": 150
        },
        "published_at": "2025-06-03T10:00:00Z"
      },
      {
        "id": 2,
        "post_id": "PLrAXdxdAX",
        "title": "フロントエンド開発コース",
        "description": "HTML, CSS, JavaScriptの基礎から応用まで",
        "post_type": "playlist",
        "visibility": "public",
        "creator": {
          "id": 1,
          "display_name": "管理者"
        },
        "content": {
          "playlist_id": "PLrAXdxdAX",
          "video_count": 5,
          "total_duration": 9000,
          "thumbnail_url": "/thumbnails/playlists/frontend-course.jpg"
        },
        "published_at": "2025-06-02T15:00:00Z"
      }
    ]
  }
}
```

### 4.2 投稿詳細取得
```http
GET /api/v1/posts/{post_id}
```

## 5. プレイリストAPI

### 5.1 プレイリスト一覧取得
```http
GET /api/v1/playlists
```

### 5.2 プレイリスト詳細取得
```http
GET /api/v1/playlists/{playlist_id}
```

#### レスポンス
```json
{
  "success": true,
  "data": {
    "id": 1,
    "playlist_id": "PLrAXdxdAX",
    "title": "フロントエンド開発コース",
    "description": "HTML, CSS, JavaScriptの基礎から応用まで学べるコースです",
    "thumbnail_url": "/thumbnails/playlists/frontend-course.jpg",
    "video_count": 5,
    "total_duration": 9000,
    "creator": {
      "id": 1,
      "display_name": "管理者"
    },
    "videos": [
      {
        "id": 1,
        "video_id": "dQw4w9WgXcQ",
        "title": "HTML基礎",
        "duration": 1800,
        "sort_order": 1,
        "thumbnail_url": "/thumbnails/html-basics.jpg"
      },
      {
        "id": 2,
        "video_id": "aBc123dEf45",
        "title": "CSS基礎",
        "duration": 2100,
        "sort_order": 2,
        "thumbnail_url": "/thumbnails/css-basics.jpg"
      }
    ],
    "created_at": "2025-06-02T14:00:00Z",
    "updated_at": "2025-06-02T15:00:00Z"
  }
}
```

### 5.3 プレイリスト作成
```http
POST /api/v1/playlists
```

#### リクエスト
```json
{
  "title": "JavaScript応用講座",
  "description": "JavaScriptの応用技術を学びます",
  "video_ids": [3, 4, 5],
  "thumbnail_url": "/thumbnails/js-advanced.jpg"
}
```

### 5.4 プレイリスト動画追加
```http
POST /api/v1/playlists/{playlist_id}/videos
```

#### リクエスト
```json
{
  "video_id": 6,
  "sort_order": 3
}
```

### 5.5 プレイリスト動画削除
```http
DELETE /api/v1/playlists/{playlist_id}/videos/{video_id}
```

## 6. カテゴリAPI

### 6.1 カテゴリ一覧取得
```http
GET /api/v1/categories
```

#### レスポンス
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": 1,
        "name": "プログラミング",
        "slug": "programming",
        "description": "プログラミング関連の動画",
        "color": "#007bff",
        "video_count": 45,
        "created_at": "2025-06-01T10:00:00Z"
      },
      {
        "id": 2,
        "name": "研修",
        "slug": "training",
        "description": "社内研修用の動画",
        "color": "#28a745",
        "video_count": 23,
        "created_at": "2025-06-01T10:05:00Z"
      }
    ]
  }
}
```

### 6.2 カテゴリ作成
```http
POST /api/v1/categories
```

### 6.3 カテゴリ更新
```http
PUT /api/v1/categories/{category_id}
```

### 6.4 カテゴリ削除
```http
DELETE /api/v1/categories/{category_id}
```

## 7. タグAPI

### 7.1 タグ一覧取得
```http
GET /api/v1/tags
```

#### クエリパラメータ
```
?q=react            # タグ名での部分検索
&limit=50           # 取得件数制限
&sort=popular       # ソート（popular, alphabetical, recent）
```

#### レスポンス
```json
{
  "success": true,
  "data": {
    "tags": [
      {
        "id": 1,
        "name": "React",
        "slug": "react",
        "video_count": 12,
        "created_at": "2025-06-01T10:00:00Z"
      },
      {
        "id": 2,
        "name": "JavaScript",
        "slug": "javascript",
        "video_count": 25,
        "created_at": "2025-06-01T10:01:00Z"
      }
    ]
  }
}
```

### 7.2 タグ検索
```http
GET /api/v1/tags/search?q={query}
```

## 8. 検索API

### 8.1 統合検索
```http
GET /api/v1/search
```

#### クエリパラメータ
```
?q=React            # 検索キーワード
&type=video         # 検索対象（video, playlist, all）
&category=programming # カテゴリフィルター
&tag=beginner       # タグフィルター
&sort=relevance     # ソート（relevance, latest, popular）
&page=1
&limit=20
```

#### レスポンス
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "type": "video",
        "id": 1,
        "video_id": "dQw4w9WgXcQ",
        "title": "React基礎講座",
        "description": "Reactの基本的な使い方を学びます",
        "thumbnail_url": "/thumbnails/react-basics.jpg",
        "duration": 1800,
        "view_count": 150,
        "relevance_score": 0.95,
        "highlighted_text": "<mark>React</mark>の基本的な使い方"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 3,
      "total_count": 42
    },
    "facets": {
      "categories": [
        {
          "name": "プログラミング",
          "count": 35
        }
      ],
      "tags": [
        {
          "name": "React",
          "count": 12
        }
      ]
    }
  }
}
```

## 9. アナリティクスAPI

### 9.1 視聴統計取得
```http
GET /api/v1/analytics/views
```

#### クエリパラメータ
```
?video_id=dQw4w9WgXcQ  # 特定動画の統計
&from=2025-06-01       # 開始日
&to=2025-06-03         # 終了日
&granularity=day       # 集計単位（hour, day, week, month）
```

#### レスポンス
```json
{
  "success": true,
  "data": {
    "total_views": 1250,
    "unique_sessions": 890,
    "average_watch_time": 340,
    "completion_rate": 65.2,
    "daily_stats": [
      {
        "date": "2025-06-01",
        "views": 420,
        "unique_sessions": 315,
        "average_watch_time": 335
      },
      {
        "date": "2025-06-02",
        "views": 380,
        "unique_sessions": 285,
        "average_watch_time": 345
      }
    ]
  }
}
```

### 9.2 人気動画統計
```http
GET /api/v1/analytics/popular
```

### 9.3 ユーザー統計
```http
GET /api/v1/analytics/users
```

## 10. ファイルアップロードAPI

### 10.1 動画アップロード開始
```http
POST /api/v1/upload/video/initiate
```

#### リクエスト
```json
{
  "filename": "lecture-video.mp4",
  "filesize": 524288000,
  "mime_type": "video/mp4"
}
```

#### レスポンス
```json
{
  "success": true,
  "data": {
    "upload_id": "upload_789xyz",
    "upload_url": "/api/v1/upload/video/chunk",
    "chunk_size": 1048576,
    "expires_at": "2025-06-03T11:00:00Z"
  }
}
```

### 10.2 チャンクアップロード
```http
POST /api/v1/upload/video/chunk
```

### 10.3 アップロード完了
```http
POST /api/v1/upload/video/complete
```

### 10.4 アップロード進捗確認
```http
GET /api/v1/upload/{upload_id}/progress
```

## 11. システム設定API

### 11.1 設定一覧取得
```http
GET /api/v1/settings
```

#### レスポンス
```json
{
  "success": true,
  "data": {
    "settings": {
      "site_title": "組織向け動画プラットフォーム",
      "max_file_size_mb": 5000,
      "allowed_video_formats": ["mp4", "mov", "avi"],
      "transcoding_enabled": true,
      "private_video_allowed_ips": ["192.168.1.0/24"]
    }
  }
}
```

### 11.2 設定更新
```http
PUT /api/v1/settings
```

## 12. データエクスポートAPI

### 12.1 動画データエクスポート
```http
GET /api/v1/export/videos
```

#### クエリパラメータ
```
?format=json        # エクスポート形式（json, csv）
&from=2025-06-01    # 開始日
&to=2025-06-03      # 終了日
```

### 12.2 エクスポート状況確認
```http
GET /api/v1/export/{export_id}/status
```

## 13. WebSocket API

### 13.1 リアルタイム通知
```javascript
// WebSocket接続
const ws = new WebSocket('wss://video.example.com/api/v1/ws');

// アップロード進捗通知
{
  "type": "upload_progress",
  "data": {
    "upload_id": "upload_789xyz",
    "progress": 65,
    "status": "uploading"
  }
}

// 変換完了通知
{
  "type": "transcoding_complete",
  "data": {
    "video_id": "dQw4w9WgXcQ",
    "status": "completed"
  }
}
```

## 15. レコメンドAPI（**新規追加**）

### 15.1 レコメンド一覧取得
```http
GET /api/v1/recommendations
```

#### クエリパラメータ
```
?type=popular           # レコメンドタイプ（popular, latest, trending, highly-rated）
&limit=12              # 取得件数（デフォルト: 12、最大: 50）
```

#### レスポンス
```json
{
  "success": true,
  "data": {
    "type": "popular",
    "videos": [
      {
        "id": 1,
        "video_id": "dQw4w9WgXcQ",
        "title": "React基礎講座",
        "description": "Reactの基本的な使い方を学びます",
        "thumbnail_url": "/thumbnails/2025/06/03/thumb1.jpg",
        "duration": 1800,
        "view_count": 150,
        "uploader": {
          "id": 2,
          "display_name": "田中講師",
          "profile_image_url": "/images/tanaka-avatar.png"
        },
        "categories": [
          {
            "id": 1,
            "name": "プログラミング",
            "slug": "programming",
            "color": "#007bff"
          }
        ],
        "tags": [
          {
            "id": 1,
            "name": "React",
            "slug": "react"
          }
        ],
        "published_at": "2025-06-03T10:00:00Z"
      }
    ],
    "generated_at": "2025-06-03T15:30:00Z",
    "cache_expires_at": "2025-06-03T15:35:00Z"
  }
}
```

### 15.2 レコメンドタイプ別仕様

#### popular（人気動画）
- **ソート**: view_count 降順
- **キャッシュ**: 5分
- **対象**: 公開済み完了動画

#### latest（新着動画）
- **ソート**: published_at 降順
- **キャッシュ**: 5分
- **対象**: 公開済み完了動画

#### trending（トレンド動画）
- **ソート**: 最近7日間の視聴回数 + 平均完了率
- **キャッシュ**: 1時間
- **最低条件**: 10回以上視聴

#### highly-rated（高評価動画）
- **ソート**: 平均完了率 降順
- **キャッシュ**: 1時間
- **最低条件**: 完了率70%以上、10回以上視聴

### 15.3 レコメンド管理API

#### キャッシュクリア
```http
DELETE /api/v1/recommendations/cache
```

#### レコメンド設定取得
```http
GET /api/v1/recommendations/settings
```

#### レコメンド統計取得
```http
GET /api/v1/recommendations/analytics
```

---

## 14. エラーコード一覧
- `AUTH_REQUIRED`: 認証が必要
- `INVALID_CREDENTIALS`: 認証情報が無効
- `TOKEN_EXPIRED`: トークンが期限切れ
- `INSUFFICIENT_PERMISSIONS`: 権限不足

### 14.2 バリデーションエラー
- `VALIDATION_ERROR`: 入力値検証エラー
- `REQUIRED_FIELD_MISSING`: 必須項目未入力
- `INVALID_FORMAT`: フォーマット不正

### 14.3 リソースエラー
- `RESOURCE_NOT_FOUND`: リソースが見つからない
- `RESOURCE_ALREADY_EXISTS`: リソースが既に存在
- `RESOURCE_LIMIT_EXCEEDED`: リソース制限超過

### 14.4 システムエラー
- `INTERNAL_SERVER_ERROR`: 内部サーバーエラー
- `SERVICE_UNAVAILABLE`: サービス利用不可
- `MAINTENANCE_MODE`: メンテナンスモード

---
**設計版数**: 1.0  
**作成日**: 2025年6月3日