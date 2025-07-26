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
# 注意: React 19を使用している場合、依存関係の競合が発生する可能性があります
npm ci --production --legacy-peer-deps

# Next.js用TypeScript設定
# グローバルインストールではなく、プロジェクトローカルでTypeScriptを使用
# 依存関係の競合がある場合は --legacy-peer-deps フラグを使用
npm install typescript @types/node --save-dev --legacy-peer-deps
npm run type-check

# 注意: グローバルインストールが必要な場合は以下のコマンドを使用
# sudo npm install -g typescript
# または、npmのグローバルディレクトリを変更する方法:
# mkdir ~/.npm-global
# npm config set prefix '~/.npm-global'
# echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
# source ~/.bashrc
```

### 7. 環境変数設定

**重要**: 環境変数は本番環境の動作に不可欠です。以下の設定が正しく行われていないと、アプリケーションが正常に動作しません。

**Next.js環境変数ファイル命名規則:**
- 開発環境: `.env.local`
- 本番環境: `.env.production`
- テスト環境: `.env.test`

```bash
# 環境設定ファイル作成（Next.js標準命名規則）
nano /var/www/video-platform/.env.production
```

`.env.production` の設定内容：

```env
# 本番環境設定
NODE_ENV=production

# データベース接続（172.16.1.174のPostgreSQLサーバー）
DATABASE_URL="postgresql://gva_user:PQaEU8Gj3vjNTT2T_SecurePass2024!@172.16.1.174:5432/gva_video_platform"

# JWT認証キー（openssl rand -base64 32 で生成）
JWT_SECRET="tK7XvP2+9mR4nQ8hE3wY5zB6vC1xA7sD2gF9kL0pM8nH4jR6tY3qW5eN1bV8cX2m"

# GPU変換サーバー設定
GPU_SERVER_URL="http://172.16.1.172:3001"

# NAS設定
NFS_MOUNTED="true"
VIDEO_ARCHIVE_PATH="/mnt/nas/archives"
NAS_VIDEOS_PATH="/mnt/nas/videos"
GPU_NAS_VIDEOS_PATH="/mnt/nas/videos"
```

```bash
# 環境ファイルの権限設定
chmod 600 /var/www/video-platform/.env.production

# 環境変数の検証
echo "=== 環境変数設定確認 ==="
echo "DATABASE_URL: $(grep DATABASE_URL /var/www/video-platform/.env.production | cut -d'=' -f2-)"
echo "GPU_SERVER_URL: $(grep GPU_SERVER_URL /var/www/video-platform/.env.production | cut -d'=' -f2-)"
echo "JWT_SECRET: $(grep JWT_SECRET /var/www/video-platform/.env.production | cut -d'=' -f2- | head -c 20)..."
echo "NFS_MOUNTED: $(grep NFS_MOUNTED /var/www/video-platform/.env.production | cut -d'=' -f2-)"
echo "VIDEO_ARCHIVE_PATH: $(grep VIDEO_ARCHIVE_PATH /var/www/video-platform/.env.production | cut -d'=' -f2-)"
echo "NAS_VIDEOS_PATH: $(grep NAS_VIDEOS_PATH /var/www/video-platform/.env.production | cut -d'=' -f2-)"

# 必須環境変数の存在確認
required_vars=("DATABASE_URL" "JWT_SECRET" "GPU_SERVER_URL" "NFS_MOUNTED")
for var in "${required_vars[@]}"; do
    if grep -q "^${var}=" /var/www/video-platform/.env.production; then
        echo "✅ ${var}: 設定済み"
    else
        echo "❌ ${var}: 未設定"
    fi
done
```

### 8. セキュリティキーの生成

```bash
# JWT認証用セキュリティキー生成
echo "JWT_SECRET=$(openssl rand -base64 32)"

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
Type=notify
User=videoapp
Group=videoapp
WorkingDirectory=/var/www/video-platform
Environment=NODE_ENV=production
EnvironmentFile=/var/www/video-platform/.env.production

# PM2を通じてアプリケーションを起動
ExecStart=/usr/bin/pm2 start ecosystem.config.js --env production --no-daemon
ExecReload=/usr/bin/pm2 reload ecosystem.config.js --env production
ExecStop=/usr/bin/pm2 stop ecosystem.config.js

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
sudp chown -R videoapp:videoapp /home/videoapp/.pm2
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

# NFSサーバー側の利用可能ディレクトリ確認
showmount -e 172.16.2.7

# /etc/fstab に NFS 4.1 マウント設定追加
echo "172.16.2.7:/videos /mnt/nas/videos nfs4 rw,hard,intr,rsize=32768,wsize=32768,timeo=14,_netdev,vers=4.1 0 0" | sudo tee -a /etc/fstab

# systemd設定リロード（重要）
sudo systemctl daemon-reload

# マウント実行
sudo mount -a

# マウント状態確認
df -h | grep nas

# 権限設定
sudo chown -R videoapp:videoapp /mnt/nas/videos
```

**重要**: NFS 4.1を使用する場合の注意点：
- `nfs4`ファイルシステムタイプを使用
- `vers=4.1`オプションを追加
- systemd設定のリロードが必要
- サーバー側のエクスポートディレクトリ名を正確に指定（`/videos`）

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

# Redis接続確認
check_redis() {
    if redis-cli -h 172.16.1.175 -p 6379 ping > /dev/null 2>&1; then
        log "✅ Redis connection: OK"
        return 0
    else
        log "❌ Redis connection: FAILED"
        return 1
    fi
}

# GPUサーバー接続確認
check_gpu_server() {
    if curl -f -s "http://172.16.1.172:3001/health" > /dev/null 2>&1; then
        log "✅ GPU server connection: OK"
        return 0
    else
        log "❌ GPU server connection: FAILED"
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
    
    if ! check_redis; then
        send_alert "Redis connection failed"
        failed=1
    fi
    
    if ! check_gpu_server; then
        send_alert "GPU server connection failed"
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

# Redis接続テスト
echo "=== Redis Connection Test ==="
redis-cli -h 172.16.1.175 -p 6379 ping

# GPUサーバー接続テスト
echo "=== GPU Server Connection Test ==="
curl -f http://172.16.1.172:3001/health

# 外部サービス連携テスト
echo "=== External Service Tests ==="
curl -f http://localhost:3000/api/health
curl -f http://localhost:3000/api/settings/public

# ログ確認
echo "=== Recent Logs ==="
sudo tail -n 20 /var/log/pm2/gva-video-platform-combined.log

# リソース使用状況
echo "=== System Resources ==="
free -h
df -h
```

## Nginxリバースプロキシ設定

### 19. Nginxインストール・基本設定

```bash
# Nginxインストール
sudo apt-get install -y nginx

# デフォルトサイトを無効化
sudo rm -f /etc/nginx/sites-enabled/default

# Nginx設定ディレクトリ作成
sudo mkdir -p /etc/nginx/sites-available
sudo mkdir -p /etc/nginx/sites-enabled
```

### 20. Nginxメイン設定

```bash
# Nginxメイン設定ファイル編集
sudo nano /etc/nginx/nginx.conf
```

Nginxメイン設定内容：

```nginx
user www-data;
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/*.conf;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    # 基本設定
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 10G;
    
    # MIMEタイプ
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    # ログ設定
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;
    
    # Gzip圧縮
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;
    
    # セキュリティヘッダー
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    
    # レート制限設定
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
    
    # アップストリーム設定（負荷分散用）
    upstream video_platform {
        server 127.0.0.1:3000;
        keepalive 32;
    }
    
    # サイト設定
    include /etc/nginx/sites-enabled/*;
}
```

### 21. アプリケーション用Nginx設定

```bash
# アプリケーション用設定ファイル作成
sudo nano /etc/nginx/sites-available/video-platform
```

アプリケーション設定内容：

```nginx
# HTTP設定（リダイレクト用）
server {
    listen 80;
    server_name video.your-domain.com;
    
    # ヘルスチェック用エンドポイント
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
    
    # メインアプリケーション
    location / {
        proxy_pass http://video_platform;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # タイムアウト設定
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # バッファ設定
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
        
        # ファイルアップロード対応
        client_max_body_size 10G;
        client_body_timeout 300s;
        client_header_timeout 60s;
    }
    
    # API用レート制限
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://video_platform;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # API用タイムアウト
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    # 認証用レート制限
    location /api/auth/ {
        limit_req zone=login burst=5 nodelay;
        
        proxy_pass http://video_platform;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # 静的ファイル配信（Next.js経由）
    location /_next/static/ {
        proxy_pass http://video_platform;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # ユーザーアバター画像の静的配信
    location /uploads/avator/ {
        root /var/www/video-platform/public;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
    }

    # ロゴ画像の静的配信
    location /uploads/logo/ {
        root /var/www/video-platform/public;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
    }
    
    # 静的ファイル配信（Nginx直接配信の場合）
    # location /static/ {
    #     root /var/www/video-platform/public;
    #     expires 1y;
    #     add_header Cache-Control "public, immutable";
    # }
    
    # 動画ファイル配信
    location /videos/ {
        proxy_pass http://video_platform;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 動画用タイムアウト
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        
        # 動画ファイル用バッファ
        proxy_buffering on;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }
    
    # サムネイル配信
    location /thumbnails/ {
        proxy_pass http://video_platform;
        expires 1d;
        add_header Cache-Control "public";
    }
    
    # エラーページ
    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;
    
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
```

### 22. Nginx設定適用

```bash
# 設定ファイルの構文チェック
sudo nginx -t

# 設定ファイル有効化
sudo ln -s /etc/nginx/sites-available/video-platform /etc/nginx/sites-enabled/

# Nginx起動・有効化
sudo systemctl enable nginx
sudo systemctl start nginx

# ファイアウォール設定更新
sudo ufw allow 'Nginx Full'
sudo ufw allow 80
sudo ufw allow 443

# 設定確認
sudo systemctl status nginx
sudo nginx -T | grep -A 10 "server_name"
```

### 23. SSL/TLS証明書設定（Let's Encrypt）

```bash
# Certbotインストール
sudo apt-get install -y certbot python3-certbot-nginx

# SSL証明書取得
sudo certbot --nginx -d video.your-domain.com

# 自動更新設定
sudo crontab -e
```

cron設定に追加：

```bash
# Let's Encrypt証明書自動更新
0 12 * * * /usr/bin/certbot renew --quiet
```

### 24. HTTPS設定の強化

```bash
# SSL設定ファイル作成
sudo nano /etc/nginx/snippets/ssl-params.conf
```

SSL設定内容：

```nginx
# SSL設定
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers on;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
ssl_ecdh_curve secp384r1;
ssl_session_timeout 10m;
ssl_session_cache shared:SSL:10m;
ssl_session_tickets off;
ssl_stapling on;
ssl_stapling_verify on;

# セキュリティヘッダー
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
add_header X-Frame-Options DENY;
add_header X-Content-Type-Options nosniff;
add_header X-XSS-Protection "1; mode=block";
```

### 25. HTTPS設定の適用

```bash
# HTTPS設定ファイル作成
sudo nano /etc/nginx/sites-available/video-platform-ssl
```

HTTPS設定内容：

```nginx
# HTTP to HTTPS リダイレクト
server {
    listen 80;
    server_name video.your-domain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS設定
server {
    listen 443 ssl http2;
    server_name video.your-domain.com;
    
    # SSL証明書
    ssl_certificate /etc/letsencrypt/live/video.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/video.your-domain.com/privkey.pem;
    include /etc/nginx/snippets/ssl-params.conf;
    
    # ヘルスチェック
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
    
    # メインアプリケーション
    location / {
        proxy_pass http://video_platform;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # タイムアウト設定
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # ファイルアップロード対応
        client_max_body_size 10G;
        client_body_timeout 300s;
        client_header_timeout 60s;
    }
    
    # API用レート制限
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://video_platform;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # 静的ファイル配信
    location /_next/static/ {
        proxy_pass http://video_platform;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # 動画ファイル配信
    location /videos/ {
        proxy_pass http://video_platform;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 動画用タイムアウト
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
    
    # サムネイル配信
    location /thumbnails/ {
        proxy_pass http://video_platform;
        expires 1d;
        add_header Cache-Control "public";
    }
}
```

```bash
# HTTPS設定適用
sudo rm -f /etc/nginx/sites-enabled/video-platform
sudo ln -s /etc/nginx/sites-available/video-platform-ssl /etc/nginx/sites-enabled/

# 設定テスト・再読み込み
sudo nginx -t
sudo systemctl reload nginx
```

### 26. Nginx監視・ログ設定

```bash
# Nginxログローテーション設定
sudo nano /etc/logrotate.d/nginx
```

Nginxログローテーション設定：

```
/var/log/nginx/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 640 www-data adm
    postrotate
        if [ -f /var/run/nginx.pid ]; then
            kill -USR1 `cat /var/run/nginx.pid`
        fi
    endscript
}
```

### 27. 最終テスト・動作確認

```bash
# Nginx設定テスト
echo "=== Nginx Configuration Test ==="
sudo nginx -t

# Nginx状態確認
echo "=== Nginx Status ==="
sudo systemctl status nginx

# ポート確認
echo "=== Port Check ==="
sudo netstat -tlnp | grep nginx

# HTTP接続テスト
echo "=== HTTP Connection Test ==="
curl -I http://video.your-domain.com/health

# HTTPS接続テスト（SSL証明書取得後）
echo "=== HTTPS Connection Test ==="
curl -I https://video.your-domain.com/health

# アプリケーション接続テスト
echo "=== Application Connection Test ==="
curl -I http://video.your-domain.com/api/health

# SSL証明書確認
echo "=== SSL Certificate Check ==="
openssl s_client -connect video.your-domain.com:443 -servername video.your-domain.com < /dev/null 2>/dev/null | openssl x509 -noout -dates

# パフォーマンステスト
echo "=== Performance Test ==="
ab -n 100 -c 10 http://video.your-domain.com/health
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

#### 3. Redis接続エラー
```bash
# Redis接続テスト
redis-cli -h 172.16.1.175 -p 6379 ping

# ネットワーク確認
ping 172.16.1.175
telnet 172.16.1.175 6379

# Redis認証確認（パスワードが設定されている場合）
redis-cli -h 172.16.1.175 -p 6379 -a your_redis_password ping
```

#### 4. GPUサーバー接続エラー
```bash
# GPUサーバー接続テスト
curl -f http://172.16.1.172:3001/health

# ネットワーク確認
ping 172.16.1.172
telnet 172.16.1.172 3001

# GPUサーバー状態確認
curl -X GET http://172.16.1.172:3001/status
```

#### 5. メモリ不足
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

#### 6. ファイルアップロードエラー
```bash
# ディスク容量確認
df -h
du -sh /var/lib/video-platform/

# 権限確認
ls -la /var/lib/video-platform/
sudo chown -R videoapp:videoapp /var/lib/video-platform/
```

#### 7. npm権限エラー
```bash
# EACCESエラーが発生した場合の対処法

# 方法1: sudoを使用（推奨）
sudo npm install -g typescript

# 方法2: npmのグローバルディレクトリを変更
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# 方法3: プロジェクトローカルでインストール（推奨）
npm install typescript @types/node --save-dev
```

#### 8. 依存関係の競合エラー（ERESOLVE）
```bash
# React 19とnext-themes等の互換性問題が発生した場合

# 方法1: --legacy-peer-depsフラグを使用（推奨）
npm install typescript @types/node --save-dev --legacy-peer-deps

# 方法2: --forceフラグを使用
npm install typescript @types/node --save-dev --force

# 方法3: 依存関係を個別にインストール
npm install typescript --save-dev --legacy-peer-deps
npm install @types/node --save-dev --legacy-peer-deps

# 方法4: package.jsonの依存関係を確認・調整
# React 19を使用している場合、next-themes等の古いライブラリを更新
npm update next-themes --legacy-peer-deps
```

#### 9. 環境変数関連エラー
```bash
# 環境変数ファイルの存在確認
ls -la /var/www/video-platform/.env.production

# 環境変数の内容確認（セキュリティに注意）
cat /var/www/video-platform/.env.production

# 必須環境変数の確認
grep -E "^(DATABASE_URL|JWT_SECRET|GPU_SERVER_URL|NFS_MOUNTED)=" /var/www/video-platform/.env.production

# 環境変数の権限確認
ls -la /var/www/video-platform/.env.production

# Next.js環境変数の読み込み確認
sudo -u videoapp npm run build

# 環境変数の再読み込み
sudo systemctl restart gva-video-platform.service

# PM2での環境変数確認
sudo -u videoapp pm2 env 0
```

#### 10. Nginx関連エラー
```bash
# Nginx設定ファイルの構文チェック
sudo nginx -t

# Nginxエラーログ確認
sudo tail -f /var/log/nginx/error.log

# Nginxアクセスログ確認
sudo tail -f /var/log/nginx/access.log

# Nginxプロセス確認
sudo systemctl status nginx
ps aux | grep nginx

# ポート確認
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :443

# ファイアウォール設定確認
sudo ufw status
sudo ufw allow 'Nginx Full'

# 設定ファイルの権限確認
ls -la /etc/nginx/sites-enabled/
ls -la /etc/nginx/sites-available/

# SSL証明書確認
sudo certbot certificates
sudo openssl x509 -in /etc/letsencrypt/live/video.your-domain.com/fullchain.pem -text -noout

# ドメイン名解決確認
nslookup video.your-domain.com
dig video.your-domain.com

# 手動でNginx再起動
sudo systemctl restart nginx
sudo nginx -s reload
```

#### 11. SSL証明書関連エラー
```bash
# Certbot状態確認
sudo certbot certificates

# 証明書更新テスト
sudo certbot renew --dry-run

# 証明書の有効期限確認
sudo openssl x509 -in /etc/letsencrypt/live/video.your-domain.com/cert.pem -noout -dates

# 証明書の自動更新設定確認
sudo crontab -l | grep certbot

# 手動で証明書更新
sudo certbot renew

# 証明書ファイルの権限確認
ls -la /etc/letsencrypt/live/video.your-domain.com/
sudo chmod 644 /etc/letsencrypt/live/video.your-domain.com/cert.pem
sudo chmod 644 /etc/letsencrypt/live/video.your-domain.com/chain.pem
sudo chmod 644 /etc/letsencrypt/live/video.your-domain.com/fullchain.pem
sudo chmod 600 /etc/letsencrypt/live/video.your-domain.com/privkey.pem
```

#### 12. リバースプロキシ関連エラー
```bash
# アップストリームサーバー接続確認
curl -I http://127.0.0.1:3000/health

# プロキシヘッダー確認
curl -H "X-Forwarded-For: 1.2.3.4" -H "X-Real-IP: 1.2.3.4" http://video.your-domain.com/api/health

# タイムアウト設定確認
grep -r "timeout" /etc/nginx/sites-available/

# バッファ設定確認
grep -r "buffer" /etc/nginx/sites-available/

# レート制限確認
grep -r "limit_req" /etc/nginx/sites-available/

# 静的ファイル配信確認
curl -I http://video.your-domain.com/_next/static/

# 動画ファイル配信確認
curl -I http://video.your-domain.com/videos/

# サムネイル配信確認
curl -I http://video.your-domain.com/thumbnails/
```

## セットアップ完了チェックリスト

- [ ] Node.js 22 LTSインストール完了
- [ ] アプリケーション用ユーザー・ディレクトリ作成完了
- [ ] FFmpeg・動画処理ツールインストール完了
- [ ] 環境変数設定完了
- [ ] 環境変数検証完了
- [ ] データベース接続・初期化完了
- [ ] Redis接続確認完了
- [ ] GPUサーバー接続確認完了
- [ ] 本番環境ビルド完了
- [ ] PM2設定・起動完了
- [ ] systemdサービス設定・有効化完了
- [ ] ファイアウォール設定完了
- [ ] ヘルスチェック・監視設定完了
- [ ] ログ設定・ローテーション完了
- [ ] セキュリティ設定（Fail2Ban）完了
- [ ] アプリケーション動作テスト完了
- [ ] 外部サービス連携テスト完了
- [ ] NAS設定完了（オプション）
- [ ] Nginxインストール・基本設定完了
- [ ] Nginxメイン設定完了
- [ ] アプリケーション用Nginx設定完了
- [ ] Nginx設定適用・起動完了
- [ ] SSL/TLS証明書設定完了
- [ ] HTTPS設定強化完了
- [ ] Nginx監視・ログ設定完了
- [ ] Nginx最終テスト・動作確認完了

---

**重要注意事項:**

### セキュリティ
- セキュリティキーは例示です。本番環境では必ず新しいキーを生成してください
- データベースパスワードは実際の設定値に合わせてください
- 環境変数ファイル（.env.production）の権限は600に設定してください
- Next.js標準の環境変数ファイル命名規則を使用してください（.env.local, .env.production）
- 定期的にセキュリティアップデートを実施してください

### パフォーマンス
- メモリ使用量を監視し、必要に応じてスワップファイルを設定してください
- ディスク容量を定期的に確認し、古いログファイルを削除してください
- PM2のプロセス数をCPUコア数に合わせて調整してください

### ネットワーク
- ファイアウォール設定で必要なポートのみを開放してください
- 外部サービス（Redis、GPUサーバー、データベース）への接続を定期的に確認してください
- Load Balancerと組み合わせる場合は、直接的なHTTPS設定は不要です

### Nginx・リバースプロキシ
- Nginx設定ファイルの構文チェックを必ず実行してください（`sudo nginx -t`）
- SSL証明書の有効期限を定期的に確認してください
- レート制限設定が適切に機能していることを確認してください
- 静的ファイルのキャッシュ設定が正しく動作していることを確認してください
- 動画ファイル配信時のタイムアウト設定を適切に調整してください

### 監視・メンテナンス
- ヘルスチェックスクリプトが正常に動作することを確認してください
- ログローテーションが適切に設定されていることを確認してください
- 定期的なバックアップと復旧テストを実施してください
- Nginxアクセスログとエラーログを定期的に確認してください