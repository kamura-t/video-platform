#!/bin/bash

# GVA Video Platform デプロイスクリプト
# 使用方法: ./scripts/deploy.sh

set -e

echo "🚀 GVA Video Platform デプロイを開始します..."

# 色付きのログ出力関数
log_info() {
    echo -e "\033[32m[INFO]\033[0m $1"
}

log_warn() {
    echo -e "\033[33m[WARN]\033[0m $1"
}

log_error() {
    echo -e "\033[31m[ERROR]\033[0m $1"
}

# 環境変数の確認
if [ ! -f ".env.local" ]; then
    log_error ".env.local ファイルが見つかりません。env.example をコピーして設定してください。"
    exit 1
fi

# 依存関係のインストール
log_info "依存関係をインストールしています..."
npm install

# TypeScript の型チェック
log_info "TypeScript の型チェックを実行しています..."
npm run type-check

# ビルド
log_info "アプリケーションをビルドしています..."
npm run build

# Prisma クライアントの生成
log_info "Prisma クライアントを生成しています..."
npx prisma generate

# データベースマイグレーション
log_info "データベースマイグレーションを実行しています..."
npx prisma db push

# PM2 の確認
if ! command -v pm2 &> /dev/null; then
    log_warn "PM2 がインストールされていません。インストールしています..."
    npm install -g pm2
fi

# ログディレクトリの作成
sudo mkdir -p /var/log/gva
sudo chown $USER:$USER /var/log/gva

# PM2 でアプリケーションを起動/再起動
log_info "PM2 でアプリケーションを起動しています..."
if pm2 list | grep -q "gva-video-platform"; then
    pm2 reload gva-video-platform
else
    pm2 start ecosystem.config.js
fi

# PM2 の自動起動設定
pm2 startup
pm2 save

log_info "✅ デプロイが完了しました！"
log_info "アプリケーションの状態を確認するには: pm2 status"
log_info "ログを確認するには: pm2 logs gva-video-platform" 