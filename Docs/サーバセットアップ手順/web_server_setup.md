# GVA Video Platform - Webサーバー設定手順書

## サーバー情報

- **IP Address**: 172.16.1.173
- **サーバー仕様**: 4 vCPU, 16GB RAM, 100GB SSD
- **OS**: Ubuntu Server 24.04 LTS
- **役割**: Next.js Webアプリケーションサーバー

## セットアップ手順

### 1. 基本システムセットアップ

```bash
# システム更新
sudo apt-get update && sudo apt-get upgrade -y

# 基本ツールのインストール
sudo apt-get install -y curl wget git htop vim ufw fail2ban build-essential
```

### 2. ファイアウォール初期設定

```bash
# UFW基本設定
sudo ufw default deny incoming
sudo ufw default allow outgoing

# SSH許可
sudo ufw allow ssh

# HTTP/HTTPS（Load Balancerからのアクセス用）
#2025/7/22時点ではロードバランサを使用しないため、設定除外
sudo ufw allow from 172.16.1.0/24 to any port 3000 

# UFW有効化
sudo ufw enable

# 設定確認
sudo ufw status
```

### 3. Node.js 22 LTSのインストール

```bash
# Node.js公式リポジトリの追加
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -

# Node.jsとnpmのインストール
sudo apt-get install -y nodejs

# バージョン確認
node --version  # v22.x.x であることを確認
npm --version

# PM2プロセスマネージャーのインストール
sudo npm install -g pm2

# PM2バージョン確認
pm2 --version
```

### 4. アプリケーション用ユーザー・ディレクトリ作成

```bash
# アプリケーション用ユーザー作成
sudo useradd -m -s /bin/bash videoapp
sudo usermod -aG sudo videoapp

# アプリケーションディレクトリ作成
sudo mkdir -p /var/www/video-platform
sudo chown videoapp:videoapp /var/www/video-platform

# ログディレクトリ作成
sudo mkdir -p /var/log/pm2
sudo mkdir -p /var/log/video-platform
sudo chown videoapp:videoapp /var/log/pm2
sudo chown videoapp:videoapp /var/log/video-platform

# アップロード・一時ファイル用ディレクトリ
sudo mkdir -p /var/lib/video-platform/{uploads,temp,thumbnails}
sudo chown -R videoapp:videoapp /var/lib/video-platform
```

### 5. FFmpeg・動画処理ツールのインストール

```bash
# FFmpegと関連ツールのインストール
sudo apt-get install -y ffmpeg imagemagick

# FFmpegバージョン確認
ffmpeg -version

# ImageMagickバージョン確認
convert -version
```


ここから 2025/7/23
### 6. アプリケーションデプロイ

```bash
# videoappユーザーに切り替え
sudo su - videoapp

# アプリケーションディレクトリに移動
cd /var/www/video-platform

# Gitリポジトリクローン（リポジトリURLは実際のものに置き換え）
git clone https://github.com/your-org/gva-video-platform.git .

# 本番用依存関係インストール
npm ci --production

# Next.js用TypeScript設定
npm install -g typescript
npm run type-check
```

### 7. 環境変数設定

```bash
# 環境設定ファイル作成
nano /var/www/video-platform/.env.production
```

`.env.production` の設定内容：

```env
# 本番環境設定
NODE_ENV=production
PORT=3000

# データベース接続（172.16.1.174のPostgreSQLサーバー）
DATABASE_URL="postgresql://gva_user:PQaEU8Gj3vjNTT2T_SecurePass2024!@172.16.1.174:5432/gva_video_platform"

# Redis接続（172.16.1.175のRedisサーバー）
REDIS_URL="redis://172.16.1.175:6379"

# JWT認証キー（openssl rand -base64 32 で生成）
JWT_SECRET="tK7XvP2+9mR4nQ8hE3wY5zB6vC1xA7sD2gF9kL0pM8nH4jR6tY3qW5eN1bV8cX2m"
JWT_REFRESH_SECRET="jH8kL5nM2pQ9wE4rT7yU1iO6aS3dF0gB7nV4cX8zL6mK3qJ9hR2eY5tP1wA4sG7k"
SESSION_SECRET="mN9bV6cX2zL5kH8jF4gD7sA0qW3eR6tY1uI8oP5aS2fG9hJ7nM4lK1xZ3vB0cN6m"

# ファイルストレージ設定
UPLOAD_PATH="/var/lib/video-platform/uploads"
TEMP_DIR="/var/lib/video-platform/temp"
THUMBNAIL_PATH="/var/lib/video-platform/thumbnails"
MAX_FILE_SIZE=10737418240  # 10GB

# 動画処理設定
FFMPEG_PATH="/usr/bin/ffmpeg"
IMAGEMAGICK_PATH="/usr/bin/convert"

# GPU変換サーバー設定
GPU_SERVER_URL="http://172.16.1.172:3001"
TRANSCODING_ENABLED=true
MAX_CONCURRENT_JOBS=4

# NAS設定（オプション）
NAS_ENABLED=true
NAS_HOST="172.16.2.7"
NAS_MOUNT_PATH="/mnt/nas/videos"
NAS_USERNAME="videouser"
NAS_PASSWORD="secure_nas_password"

# API設定
API_BASE_URL="https://your-domain.com"
ALLOWED_ORIGINS="https://your-domain.com,https://www.your-domain.com"

# セキュリティ設定
PRIVATE_NETWORK_RANGES="192.168.0.0/16,172.16.0.0/12,10.0.0.0/8"
RATE_LIMIT_WINDOW=900000  # 15分
RATE_LIMIT_MAX_REQUESTS=1000

# YouTube API設定（オプション）
YOUTUBE_API_KEY="your_youtube_api_key_here"

# Google Translate設定
GOOGLE_TRANSLATE_ENABLED=true
GOOGLE_TRANSLATE_PAGE_LANGUAGE=ja
GOOGLE_TRANSLATE_INCLUDED_LANGUAGES=en,ko,zh-CN,zh-TW,th,vi,es,fr,de

# メール設定（通知用）
SMTP_HOST="smtp.your-domain.com"
SMTP_PORT=587
SMTP_USER="noreply@your-domain.com"
SMTP_PASS="smtp_secure_password"
SMTP_FROM="GVA Video Platform <noreply@your-domain.com>"
```

```bash
# 環境ファイルの権限設定
chmod 600 /var/www/video-platform/.env.production
```

### 8. セキュリティキーの生成

```bash
# JWT・セッション用セキュリティキー生成
echo "JWT_SECRET=$(openssl rand -base64 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 32)"
echo "SESSION_SECRET=$(openssl rand -base64 32)"

# 生成されたキーを.env.productionに設定
```

### 9. データベース初期化

```bash
# Prismaクライアント生成
npm run db:generate

# データベーススキーマの適用（初回のみ）
npm run db:push

# 初期データの投入
npm run db:seed

# 接続テスト・型チェック
npm run type-check
```

### 10. PM2設定

```bash
# PM2設定ファイル作成
nano /var/www/video-platform/ecosystem.config.js
```

`ecosystem.config.js` の内容：

```javascript
module.exports = {
  apps: [
    {
      name: 'gva-video-platform',
      script: 'npm',
      args: 'start',
      cwd: '/var/www/video-platform',
      instances: 'max',  // CPUコア数に合わせて自動調整
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      // ログ設定
      error_file: '/var/log/pm2/gva-video-platform-error.log',
      out_file: '/var/log/pm2/gva-video-platform-out.log',
      log_file: '/var/log/pm2/gva-video-platform-combined.log',
      time: true,
      
      // メモリ・パフォーマンス設定
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024',
      
      // プロセス管理設定
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      
      // 自動再起動設定
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      
      // 監視設定
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.git'],
      
      // 環境変数
      env_file: '/var/www/video-platform/.env.production'
    }
  ]
};
```

### 11. 本番環境ビルド

```bash
# 本番用ビルド実行
cd /var/www/video-platform
npm run build

# ビルド結果確認
ls -la .next/
```

### 12. systemd サービス設定

```bash
# videoappユーザーを終了してrootに戻る
exit

# systemdサービスファイル作成
sudo nano /etc/systemd/system/gva-video-platform.service
```

systemdサービス設定：

```ini
[Unit]
Description=GVA Video Platform Application
After=network.target

[Service]
Type=forking
User=videoapp
Group=videoapp
WorkingDirectory=/var/www/video-platform
Environment=NODE_ENV=production
EnvironmentFile=/var/www/video-platform/.env.production

# PM2を通じてアプリケーションを起動
ExecStart=/usr/bin/pm2 start ecosystem.config.js --env production
ExecReload=/usr/bin/pm2 reload ecosystem.config.js --env production
ExecStop=/usr/bin/pm2 delete ecosystem.config.js

# 再起動設定
Restart=always
RestartSec=10
TimeoutStartSec=120
TimeoutStopSec=60

# セキュリティ設定
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/video-platform
ReadWritePaths=/var/log/pm2
ReadWritePaths=/var/log/video-platform

[Install]
WantedBy=multi-user.target
```

```bash
# systemdサービス有効化・開始
sudo systemctl daemon-reload
sudo systemctl enable gva-video-platform.service
sudo systemctl start gva-video-platform.service

# サービス状態確認
sudo systemctl status gva-video-platform.service
```

### 13. NAS マウント設定（オプション）

```bash
# NFSクライアントインストール
sudo apt-get install -y nfs-common

# マウントポイント作成
sudo mkdir -p /mnt/nas/videos

# /etc/fstab に NFS マウント設定追加
echo "172.16.2.7:/share/videos /mnt/nas/videos nfs rw,hard,intr,rsize=32768,wsize=32768,tcp,timeo=14,_netdev 0 0" | sudo tee -a /etc/fstab

# マウント実行
sudo mount -a

# マウント状態確認
df -h | grep nas

# 権限設定
sudo chown -R videoapp:videoapp /mnt/nas/videos
```

### 14. 監視・ヘルスチェック設定

```bash
# ヘルスチェックスクリプト作成
sudo nano /opt/health-check.sh
```

ヘルスチェックスクリプト：

```bash
#!/bin/bash
# GVA Video Platform ヘルスチェックスクリプト

LOG_FILE="/var/log/video-platform/health-check.log"
APP_URL="http://localhost:3000"
WEBHOOK_URL="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"  # Slack通知用

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_FILE
}

# アプリケーションヘルスチェック
check_application() {
    if curl -f -s "${APP_URL}/api/health" > /dev/null 2>&1; then
        log "✅ Application health check: OK"
        return 0
    else
        log "❌ Application health check: FAILED"
        return 1
    fi
}

# PM2プロセス確認
check_pm2() {
    PM2_STATUS=$(pm2 jlist | jq -r '.[0].pm2_env.status' 2>/dev/null)
    if [ "$PM2_STATUS" = "online" ]; then
        log "✅ PM2 process status: OK"
        return 0
    else
        log "❌ PM2 process status: FAILED ($PM2_STATUS)"
        return 1
    fi
}

# データベース接続確認
check_database() {
    if curl -f -s "${APP_URL}/api/health/database" > /dev/null 2>&1; then
        log "✅ Database connection: OK"
        return 0
    else
        log "❌ Database connection: FAILED"
        return 1
    fi
}

# ディスク使用量確認
check_disk_usage() {
    DISK_USAGE=$(df -h /var/lib/video-platform | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ $DISK_USAGE -lt 80 ]; then
        log "✅ Disk usage: ${DISK_USAGE}% (OK)"
        return 0
    else
        log "⚠️ Disk usage: ${DISK_USAGE}% (WARNING)"
        return 1
    fi
}

# メモリ使用量確認
check_memory() {
    MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.1f", ($3/$2) * 100.0}')
    MEMORY_USAGE_INT=$(echo $MEMORY_USAGE | cut -d. -f1)
    
    if [ $MEMORY_USAGE_INT -lt 90 ]; then
        log "✅ Memory usage: ${MEMORY_USAGE}% (OK)"
        return 0
    else
        log "⚠️ Memory usage: ${MEMORY_USAGE}% (HIGH)"
        return 1
    fi
}

# Slack通知（エラー時）
send_alert() {
    local message="$1"
    if [ -n "$WEBHOOK_URL" ] && [ "$WEBHOOK_URL" != "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 Web Server Alert (172.16.1.173): ${message}\"}" \
            "$WEBHOOK_URL" > /dev/null 2>&1
    fi
}

# メインヘルスチェック実行
main() {
    log "=== Health Check Started ==="
    
    local failed=0
    
    if ! check_application; then
        send_alert "Application health check failed"
        failed=1
    fi
    
    if ! check_pm2; then
        send_alert "PM2 process check failed"
        failed=1
    fi
    
    if ! check_database; then
        send_alert "Database connection failed"
        failed=1
    fi
    
    if ! check_disk_usage; then
        send_alert "Disk usage warning"
    fi
    
    if ! check_memory; then
        send_alert "Memory usage high"
    fi
    
    if [ $failed -eq 0 ]; then
        log "=== Health Check Completed: ALL OK ==="
    else
        log "=== Health Check Completed: ISSUES DETECTED ==="
        exit 1
    fi
}

main "$@"
```

```bash
# スクリプト実行権限設定
sudo chmod +x /opt/health-check.sh

# テスト実行
sudo -u videoapp /opt/health-check.sh
```

### 15. 定期実行・監視設定

```bash
# videoappユーザーのcron設定
sudo crontab -u videoapp -e
```

cron設定内容：

```bash
# GVA Video Platform 定期タスク

# ヘルスチェック（5分毎）
*/5 * * * * /opt/health-check.sh

# PM2プロセス監視・自動復旧（1分毎）
*/1 * * * * /usr/bin/pm2 resurrect

# アプリケーションログローテーション（毎日午前2時）
0 2 * * * /usr/bin/pm2 flush

# 一時ファイルクリーンアップ（毎日午前1時）
0 1 * * * find /var/lib/video-platform/temp -type f -mtime +1 -delete

# アップロードディレクトリ容量監視（毎時）
0 * * * * du -sh /var/lib/video-platform/uploads | mail -s "Upload Directory Size" admin@your-domain.com
```

### 16. ログ設定・ローテーション

```bash
# PM2ログローテーション設定
sudo nano /etc/logrotate.d/pm2
```

PM2ログローテーション設定：

```
/var/log/pm2/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 videoapp videoapp
    postrotate
        /usr/bin/pm2 flush > /dev/null 2>&1 || true
    endscript
}
```

```bash
# アプリケーションログローテーション設定
sudo nano /etc/logrotate.d/video-platform
```

アプリケーションログローテーション設定：

```
/var/log/video-platform/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 videoapp videoapp
    postrotate
        systemctl reload gva-video-platform > /dev/null 2>&1 || true
    endscript
}
```

### 17. セキュリティ強化設定

```bash
# Fail2Ban Web アプリケーション用設定
sudo nano /etc/fail2ban/jail.d/video-platform.conf
```

Fail2Ban設定：

```ini
[video-platform]
enabled = true
port = 3000
filter = video-platform
logpath = /var/log/pm2/gva-video-platform-combined.log
maxretry = 10
bantime = 3600
findtime = 600
```

```bash
# Fail2Banフィルター作成
sudo nano /etc/fail2ban/filter.d/video-platform.conf
```

フィルター設定：

```ini
[Definition]
failregex = ^.*Authentication failed for.*<HOST>.*$
            ^.*Invalid login attempt from.*<HOST>.*$
            ^.*Rate limit exceeded.*<HOST>.*$
ignoreregex =
```

```bash
# Fail2Ban設定適用
sudo systemctl restart fail2ban
sudo fail2ban-client status
```

### 18. 最終テスト・動作確認

```bash
# アプリケーション状態確認
echo "=== Application Status ==="
sudo systemctl status gva-video-platform.service

# PM2プロセス確認
sudo -u videoapp pm2 status

# ポート確認
echo "=== Port Check ==="
sudo netstat -tlnp | grep 3000

# アプリケーション接続テスト
echo "=== Application Test ==="
curl -I http://localhost:3000

# データベース接続テスト
echo "=== Database Connection Test ==="
curl -f http://localhost:3000/api/health/database

# ログ確認
echo "=== Recent Logs ==="
sudo tail -n 20 /var/log/pm2/gva-video-platform-combined.log

# リソース使用状況
echo "=== System Resources ==="
free -h
df -h
```

## SSL/TLS証明書設定（オプション・Load Balancer併用時）

Load Balancerを使用しない場合のSSL設定：

```bash
# Nginx インストール（リバースプロキシ用）
sudo apt-get install -y nginx certbot python3-certbot-nginx

# Nginx設定
sudo nano /etc/nginx/sites-available/video-platform
```

Nginx設定内容：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        client_max_body_size 10G;
    }
}
```

```bash
# サイト有効化
sudo ln -s /etc/nginx/sites-available/video-platform /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# SSL証明書取得
sudo certbot --nginx -d your-domain.com
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. アプリケーション起動エラー
```bash
# PM2ログ確認
sudo -u videoapp pm2 logs gva-video-platform

# 環境変数確認
sudo -u videoapp pm2 env 0

# 手動起動テスト
sudo -u videoapp npm run build
sudo -u videoapp npm start
```

#### 2. データベース接続エラー
```bash
# 接続テスト
psql -h 172.16.1.174 -U gva_user -d gva_video_platform

# ネットワーク確認
ping 172.16.1.174
telnet 172.16.1.174 5432
```

#### 3. メモリ不足
```bash
# スワップファイル作成
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# PM2メモリ制限調整
# ecosystem.config.js の max_memory_restart を調整
```

#### 4. ファイルアップロードエラー
```bash
# ディスク容量確認
df -h
du -sh /var/lib/video-platform/

# 権限確認
ls -la /var/lib/video-platform/
sudo chown -R videoapp:videoapp /var/lib/video-platform/
```

## セットアップ完了チェックリスト

- [ ] Node.js 20 LTSインストール完了
- [ ] アプリケーション用ユーザー・ディレクトリ作成完了
- [ ] 環境変数設定完了
- [ ] データベース接続・初期化完了
- [ ] 本番環境ビルド完了
- [ ] PM2設定・起動完了
- [ ] systemdサービス設定・有効化完了
- [ ] ファイアウォール設定完了
- [ ] ヘルスチェック・監視設定完了
- [ ] ログ設定・ローテーション完了
- [ ] セキュリティ設定（Fail2Ban）完了
- [ ] アプリケーション動作テスト完了
- [ ] 外部サービス連携テスト完了

---

**注意事項:**
- セキュリティキーは例示です。本番環境では必ず新しいキーを生成してください
- データベースパスワードは実際の設定値に合わせてください
- Load Balancerと組み合わせる場合は、直接的なHTTPS設定は不要です
- 定期的な監視とメンテナンスを実施してください