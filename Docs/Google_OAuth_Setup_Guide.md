# Google OAuth認証セットアップガイド

## 概要

このガイドでは、GVA Video Platformに Google Workspace OAuth認証を統合する手順を説明します。組織のGoogleアカウントでのログインを可能にし、既存のパスワードベース認証と共存させることができます。

## 特徴

- **デュアル認証システム**: パスワード認証とGoogle OAuth認証の共存
- **組織ドメイン制限**: 許可されたドメインのみアクセス可能
- **自動権限設定**: GoogleユーザーはVIEWER権限で自動作成
- **セキュアな実装**: 既存システムに影響なし

## 前提条件

- Google Cloud Console へのアクセス権限
- 管理者権限（環境変数設定のため）
- SSL証明書（本番環境の場合）

## セットアップ手順

### 1. Google Cloud Console設定

#### 1.1 プロジェクト作成・選択
1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 新しいプロジェクトを作成するか、既存のプロジェクトを選択

#### 1.2 OAuth同意画面の設定
1. **APIとサービス** → **OAuth同意画面** を選択
2. **外部** を選択（組織内のみの場合は **内部** を選択）
3. 必要な情報を入力：
   - アプリ名: `GVA Video Platform`
   - ユーザーサポートメール: 管理者のメールアドレス
   - 承認済みドメイン: アプリケーションのドメイン
   - 開発者の連絡先情報: 管理者のメールアドレス

#### 1.3 OAuth2クライアント作成
1. **APIとサービス** → **認証情報** を選択
2. **認証情報を作成** → **OAuth 2.0 クライアント ID** を選択
3. アプリケーションの種類: **ウェブアプリケーション**
4. 名前: `GVA Video Platform OAuth`
5. **承認済みのリダイレクト URI** を追加：
   ```
   http://localhost:3000/api/auth/google/callback  (開発環境)
   https://yourdomain.com/api/auth/google/callback (本番環境)
   ```
6. **作成** をクリック
7. **クライアントID** と **クライアントシークレット** をコピー

#### 1.4 必要なAPIの有効化
1. **APIとサービス** → **ライブラリ** を選択
2. 以下のAPIを検索して有効化：
   - Google+ API
   - Google People API

### 2. 環境変数設定

`.env.local` ファイルに以下の設定を追加：

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID="your-google-client-id-here"
GOOGLE_CLIENT_SECRET="your-google-client-secret-here"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/google/callback"
NEXTAUTH_URL="http://localhost:3000"

# Allowed Google Workspace domains (comma-separated)
ALLOWED_GOOGLE_DOMAINS="yourcompany.com,subsidiary.com"
```

#### 設定項目の説明

| 項目 | 説明 | 例 |
|------|------|-----|
| `GOOGLE_CLIENT_ID` | Google Cloud ConsoleのクライアントID | `123456789-abc...googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Consoleのクライアントシークレット | `GOCSPX-...` |
| `GOOGLE_REDIRECT_URI` | OAuth認証後のリダイレクトURI | `https://yourdomain.com/api/auth/google/callback` |
| `NEXTAUTH_URL` | アプリケーションのベースURL | `https://yourdomain.com` |
| `ALLOWED_GOOGLE_DOMAINS` | 許可するドメイン（カンマ区切り） | `company.com,group.company.com` |

### 3. データベース移行

データベーススキーマの更新を実行：

```bash
# Prismaクライアント生成
npm run db:generate

# データベーススキーマ更新
npm run db:push
```

### 4. アプリケーション起動

```bash
# 開発サーバー起動
npm run dev

# 型チェック
npm run type-check
```

## 使用方法

### ユーザーの操作手順

1. ログインページ（`/login`）にアクセス
2. **Google Workspaceでログイン** ボタンをクリック
3. Google認証画面でアカウント選択
4. 初回ログイン時は自動的にVIEWER権限のアカウントが作成
5. 認証成功後、アカウントページ（`/account`）にリダイレクト

### 管理者の権限変更

Googleアカウントでログインしたユーザーの権限を変更する場合：

1. 管理者アカウントでログイン
2. **管理者パネル** → **ユーザー管理** にアクセス
3. 対象ユーザーを検索（`認証方式: Google` でフィルタ可能）
4. 権限を **VIEWER** から **CURATOR** または **ADMIN** に変更

## セキュリティ設定

### ドメイン制限

組織外のGoogleアカウントからのアクセスを防ぐため、`ALLOWED_GOOGLE_DOMAINS` 環境変数で許可ドメインを指定：

```env
# 単一ドメイン
ALLOWED_GOOGLE_DOMAINS="yourcompany.com"

# 複数ドメイン
ALLOWED_GOOGLE_DOMAINS="main.com,subsidiary.com,partner.com"

# 制限なし（非推奨）
# ALLOWED_GOOGLE_DOMAINS=""
```

### HTTPS設定（本番環境）

本番環境では必ずHTTPSを使用：

```env
NEXTAUTH_URL="https://yourdomain.com"
GOOGLE_REDIRECT_URI="https://yourdomain.com/api/auth/google/callback"
```

### クッキー設定

本番環境では自動的に以下の設定が適用：

- `httpOnly: true` - XSS攻撃対策
- `secure: true` - HTTPS必須
- `sameSite: 'lax'` - CSRF攻撃対策

## トラブルシューティング

### 診断ツール

認証問題の診断に便利なコマンド:

```bash
# データベース接続確認
npm run db:generate

# 型チェック
npm run type-check

# 開発サーバー起動（ログ確認）
npm run dev
```

### よくある問題

#### 1. リダイレクトURIエラー

**エラー**: `redirect_uri_mismatch`

**解決方法**:
- Google Cloud ConsoleのリダイレクトURIと環境変数の設定が一致しているか確認
- プロトコル（http/https）が正しいか確認
- トレイリングスラッシュの有無を確認

#### 2. ドメイン制限エラー

**エラー**: `domain_not_allowed`

**解決方法**:
- `ALLOWED_GOOGLE_DOMAINS` 環境変数の設定を確認
- ドメインの綴りを確認
- カンマ区切りの形式が正しいか確認

#### 3. アクセストークンエラー

**エラー**: `invalid_token`

**解決方法**:
- Google Cloud ConsoleでAPIが有効化されているか確認
- クライアントIDとクライアントシークレットが正しいか確認
- OAuth同意画面の設定が完了しているか確認

#### 4. 既存メールアドレスの重複

**エラー**: `email_already_exists`

**解決方法**:
- 該当メールアドレスのユーザーが既にパスワード認証で登録されている
- 管理者が手動でユーザーの認証方式を統合する必要がある

#### 5. データベーススキーマエラー

**エラー**: `Property 'authProvider' does not exist`

**解決方法**:
```bash
# Prismaスキーマ更新
npm run db:push --accept-data-loss
npm run db:generate
```

#### 6. 環境変数未設定

**エラー**: `GOOGLE_CLIENT_ID is not defined`

**解決方法**:
- `.env.local` ファイルが正しく配置されているか確認
- 環境変数名の綴りを確認
- サーバーの再起動

### ログの確認

アプリケーションログで認証フローを確認：

```bash
# 開発環境
npm run dev

# ブラウザの開発者ツールでネットワークタブを確認
# サーバーコンソールでログを確認
```

### デバッグ情報

認証に関する詳細情報は以下のエンドポイントで確認可能：

- `GET /api/auth/me` - 現在のユーザー情報
- Server logs - Google OAuth認証フローのログ

## 本番環境での考慮事項

### 1. 環境変数の管理

本番環境では環境変数を安全に管理：

```bash
# 本番環境での設定例
GOOGLE_CLIENT_ID="production-client-id"
GOOGLE_CLIENT_SECRET="production-client-secret"
NEXTAUTH_URL="https://video.yourcompany.com"
ALLOWED_GOOGLE_DOMAINS="yourcompany.com"
```

### 2. ログ監視

認証関連のログを監視：

- 認証成功/失敗の記録
- 不正アクセスの検出
- ドメイン制限違反の監視

### 3. バックアップ

OAuth設定の変更前には必ずバックアップを取得：

- データベースのバックアップ
- 環境変数設定のバックアップ
- Google Cloud Console設定のスクリーンショット

## 更新履歴

- **v1.0** (2025-07-22): 初期リリース
  - Google OAuth認証機能の実装
  - デュアル認証システムの構築
  - 組織ドメイン制限機能の追加

## サポート

問題が発生した場合は、以下の情報を収集してサポートに連絡：

1. エラーメッセージの詳細
2. 環境変数の設定（秘密情報は除く）
3. Google Cloud Consoleの設定スクリーンショット
4. アプリケーションログ

---

**注意**: Google OAuth認証を有効にする前に、必ずテスト環境での動作確認を実施してください。