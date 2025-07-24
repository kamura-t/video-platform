# インフラ設定書

## 1. インフラ構成概要

### 1.1 物理・仮想サーバー構成
```
Proxmox Host (物理サーバー)
├── Web Server #1 VM     - Ubuntu Server 24.04 LTS [Next.js]
├── Database VM          - Ubuntu Server 24.04 LTS [PostgreSQL]
├── Redis VM             - Ubuntu Server 24.04 LTS [Redis]
├── GPU Transcoding      - Ubuntu Server 24.04 LTS (物理サーバー)
└── QNAP NAS            - QTS (物理サーバー)
```

### 1.2 ネットワーク構成
```
172.16.1.0/24 (内部ネットワーク)
├── 172.16.1.173    Web Server #1 (4 vCPU, 16GB RAM, 100GB SSD)
├── 172.16.1.174    Database Server (8 vCPU, 16GB RAM, 500GB SSD)
├── 172.16.1.175    Redis Server (4 vCPU, 8GB RAM, 100GB SSD)
├── 172.16.2.7  QNAP NAS
└──172.16.1.172   GPU Transcoding Server
```

## 2. Proxmox 仮想化環境

### 2.1 Proxmox 設定
```bash
# Proxmox ホスト設定
pve-firewall enable
pve-firewall set enable 1

# ストレージ設定
pvesm add dir local-vm --path /var/lib/vz --content images,iso,vztmpl
pvesm add dir backup --path /backup --content backup
```

### 2.2 VM テンプレート作成
```bash
# Ubuntu 24.04 LTS テンプレート作成
qm create 9000 --name ubuntu-24.04-template \
  --memory 2048 --cores 2 --net0 virtio,bridge=vmbr0 \
  --scsihw virtio-scsi-pci --scsi0 local-lvm:32 \
  --ide2 local:iso/ubuntu-24.04-server-amd64.iso,media=cdrom \
  --boot c --bootdisk scsi0 --serial0 socket --vga serial0

# テンプレート変換
qm template 9000

# 各サーバー用VM作成コマンド例
# Load Balancer VM
qm clone 9000 101 --name load-balancer --full
qm set 101 --memory 4096 --cores 2 --scsi0 local-lvm:50

# Web Server VMs
qm clone 9000 102 --name web-server-1 --full
qm set 102 --memory 8192 --cores 4 --scsi0 local-lvm:100

qm clone 9000 103 --name web-server-2 --full
qm set 103 --memory 8192 --cores 4 --scsi0 local-lvm:100

# Database VM
qm clone 9000 104 --name database-server --full
qm set 104 --memory 16384 --cores 8 --scsi0 local-lvm:500

# Redis VM (推奨スペック)
qm clone 9000 105 --name redis-server --full
qm set 105 --memory 16384 --cores 4 --scsi0 local-lvm:100
```

### 2.3 VM プロビジョニング
```yaml
# cloud-init設定例
#cloud-config
users:
  - name: ubuntu
    sudo: ALL=(ALL) NOPASSWD:ALL
    ssh_authorized_keys:
      - ssh-rsa AAAAB3NzaC1yc2E... # 公開鍵

package_update: true
package_upgrade: true

packages:
  - curl
  - wget
  - git
  - htop
  - ufw
  - fail2ban

runcmd:
  - systemctl enable ufw
  - ufw default deny incoming
  - ufw default allow outgoing
  - ufw allow ssh
  - ufw --force enable
```

## 3. Load Balancer (Nginx) 設定

### 3.1 Nginx インストール・設定
```bash
# Nginx インストール
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx

# 設定ディレクトリ作成
sudo mkdir -p /etc/nginx/sites-available
sudo mkdir -p /etc/nginx/ssl
```

### 3.2 Nginx 設定ファイル
```nginx
# /etc/nginx/sites-available/video-platform
upstream backend_servers {
    least_conn;
    server 172.16.1.174:3000 max_fails=3 fail_timeout=30s;
    server 172.16.1.175:3000 max_fails=3 fail_timeout=30s;
}

# HTTP to HTTPS リダイレクト
server {
    listen 80;
    server_name video.example.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS サーバー設定
server {
    listen 443 ssl http2;
    server_name video.example.com;

    # SSL証明書設定
    ssl_certificate /etc/letsencrypt/live/video.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/video.example.com/privkey.pem;
    
    # SSL設定
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;
    
    # セキュリティヘッダー
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # アップロードサイズ制限
    client_max_body_size 6G;
    client_body_timeout 300s;
    client_header_timeout 300s;

    # プロキシ設定
    location / {
        proxy_pass http://backend_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        
        # WebSocket サポート
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # タイムアウト設定
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 動画ストリーミング用設定
    location /stream/public/ {
        # パブリック動画：全てのアクセス許可
        proxy_pass http://backend_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # ストリーミング最適化
        proxy_buffering off;
        proxy_cache off;
        proxy_request_buffering off;
        
        # 長時間接続対応
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    location /stream/private/ {
        # プライベート動画：組織内IPレンジのみ許可
        allow 172.16.1.0/24;
        allow 192.168.1.0/24;
        deny all;
        
        proxy_pass http://backend_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # ストリーミング最適化
        proxy_buffering off;
        proxy_cache off;
        proxy_request_buffering off;
        
        # 長時間接続対応
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # 動画ファイル配信
    location /videos/ {
        alias /mnt/nas/videos/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        
        # 動画ストリーミング最適化
        mp4;
        mp4_buffer_size 1m;
        mp4_max_buffer_size 5m;
        
        # セキュリティヘッダー
        add_header X-Content-Type-Options nosniff;
        add_header X-Frame-Options DENY;
    }
    location /videos/ {
        alias /mnt/nas/videos/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        
        # 動画ストリーミング最適化
        mp4;
        mp4_buffer_size 1m;
        mp4_max_buffer_size 5m;
        
        # セキュリティヘッダー
        add_header X-Content-Type-Options nosniff;
        add_header X-Frame-Options DENY;
    }

    # 静的ファイル配信
    location /static/ {
        alias /var/www/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # ヘルスチェック
    location /health {
        access_log off;
        return 200 "OK\n";
        add_header Content-Type text/plain;
    }
}
```

### 3.3 SSL証明書設定
```bash
# Let's Encrypt 証明書取得
sudo certbot --nginx -d video.example.com

# 自動更新設定
sudo crontab -e
0 12 * * * /usr/bin/certbot renew --quiet
```

### 3.4 ログ設定
```nginx
# /etc/nginx/nginx.conf
http {
    # ログフォーマット定義
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for" '
                    'rt=$request_time uct="$upstream_connect_time" '
                    'uht="$upstream_header_time" urt="$upstream_response_time"';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;
}
```

## 4. Web Server (Next.js) 設定

### 4.1 Node.js インストール
```bash
# Node.js 20 LTS インストール
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2 インストール
sudo npm install -g pm2

# アプリケーション用ユーザー作成
sudo useradd -m -s /bin/bash videoapp
sudo usermod -aG sudo videoapp
```

### 4.2 アプリケーションデプロイ
```bash
# アプリケーションディレクトリ作成
sudo mkdir -p /var/www/video-platform
sudo chown videoapp:videoapp /var/www/video-platform

# アプリケーションクローン
cd /var/www/video-platform
git clone https://github.com/your-org/video-platform.git .

# 依存関係インストール
npm ci --production

# ビルド
npm run build
```

### 4.3 PM2 設定
```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'video-platform',
      script: 'npm',
      args: 'start',
      cwd: '/var/www/video-platform',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/log/pm2/video-platform-error.log',
      out_file: '/var/log/pm2/video-platform-out.log',
      log_file: '/var/log/pm2/video-platform-combined.log',
      time: true,
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024'
    }
  ]
};
```

### 4.4 systemd サービス設定
```ini
# /etc/systemd/system/video-platform.service
[Unit]
Description=Video Platform Application
After=network.target

[Service]
Type=forking
User=videoapp
WorkingDirectory=/var/www/video-platform
ExecStart=/usr/bin/pm2 start ecosystem.config.js --env production
ExecReload=/usr/bin/pm2 reload ecosystem.config.js --env production
ExecStop=/usr/bin/pm2 delete ecosystem.config.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 4.5 環境変数設定
```bash
# /var/www/video-platform/.env.production
NODE_ENV=production
PORT=3000

# データベース接続
DATABASE_URL=postgresql://videouser:password@172.16.1.174:5432/video_platform
REDIS_URL=redis://172.16.1.175:6379

# JWT設定
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key

# NAS設定
NAS_HOST=172.16.2.7
NAS_MOUNT_PATH=/mnt/nas/videos
NAS_USERNAME=videouser
NAS_PASSWORD=nas_password

# GPU変換サーバー
TRANSCODING_SERVER=http://172.16.1.172:8080
TRANSCODING_QUEUE_PATH=/var/transcoding/queue

# YouTube API
YOUTUBE_API_KEY=your_youtube_api_key

# メール設定
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=smtp_password
```

## 5. データベース (PostgreSQL) 設定

### 5.1 PostgreSQL インストール
```bash
# PostgreSQL 16 インストール
sudo apt update
sudo apt install -y postgresql-16 postgresql-contrib-16

# 設定ディレクトリ
sudo -u postgres psql
```

### 5.2 データベース・ユーザー作成
```sql
-- データベース作成
CREATE DATABASE video_platform;

-- ユーザー作成
CREATE USER videouser WITH ENCRYPTED PASSWORD 'secure_password';

-- 権限付与
GRANT ALL PRIVILEGES ON DATABASE video_platform TO videouser;
GRANT ALL ON SCHEMA public TO videouser;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO videouser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO videouser;

-- 接続設定
ALTER DATABASE video_platform OWNER TO videouser;
```

### 5.3 PostgreSQL 設定調整
```ini
# /etc/postgresql/16/main/postgresql.conf
listen_addresses = '172.16.1.174'
port = 5432

# メモリ設定
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB

# 接続設定
max_connections = 200
max_prepared_transactions = 100

# ログ設定
log_destination = 'csvlog'
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_statement = 'mod'
log_min_duration_statement = 1000

# パフォーマンス設定
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
```

### 5.4 アクセス制御設定
```
# /etc/postgresql/16/main/pg_hba.conf
local   all             postgres                                peer
local   all             all                                     peer
host    video_platform  videouser       172.16.1.0/24         md5
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
```

### 5.5 バックアップ設定
```bash
#!/bin/bash
# /opt/scripts/backup-database.sh
BACKUP_DIR="/backup/postgresql"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="video_platform_${DATE}.sql"

mkdir -p ${BACKUP_DIR}

# データベースダンプ
pg_dump -h localhost -U videouser -d video_platform > "${BACKUP_DIR}/${FILENAME}"

# 圧縮
gzip "${BACKUP_DIR}/${FILENAME}"

# 古いバックアップ削除（30日以上前）
find ${BACKUP_DIR} -name "*.gz" -mtime +30 -delete

echo "Backup completed: ${FILENAME}.gz"
```

## 6. Redis 設定

### 6.1 Redis インストール・設定
```bash
# Redis インストール
sudo apt update && sudo apt install -y redis-server

# 設定ファイル編集
sudo nano /etc/redis/redis.conf
```

### 6.2 Redis 設定調整
```conf
# /etc/redis/redis.conf

# ネットワーク設定
bind 172.16.1.175
port 6379
protected-mode yes

# 認証設定
requirepass your_redis_password

# メモリ設定 (企業動画プラットフォーム向け最適化)
maxmemory 3gb
maxmemory-policy allkeys-lru

# パフォーマンス最適化
tcp-backlog 511
timeout 300
tcp-keepalive 300

# 永続化最適化
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /var/lib/redis

# セッション・キャッシュ最適化
hash-max-ziplist-entries 512
hash-max-ziplist-value 64
list-max-ziplist-size -2
list-compress-depth 0
set-max-intset-entries 512
zset-max-ziplist-entries 128
zset-max-ziplist-value 64

# 永続化設定
save 900 1
save 300 10
save 60 10000

# ログ設定
loglevel notice
logfile /var/log/redis/redis-server.log

# クライアント設定
timeout 300
tcp-keepalive 300
```

### 6.3 Redis セキュリティ設定
```bash
# ファイアウォール設定
sudo ufw allow from 172.16.1.0/24 to any port 6379

# Redis サービス有効化
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

## 7. NFS マウント設定

### 7.1 QNAP NAS 設定
```bash
# QNAP NFS 共有設定（QNAP管理画面）
共有フォルダ: /share/videos
NFS権限: 172.16.1.0/24 (rw,sync,no_subtree_check,no_root_squash)
```

### 7.2 クライアント側マウント設定
```bash
# NFSクライアントインストール
sudo apt install -y nfs-common

# マウントポイント作成
sudo mkdir -p /mnt/nas/videos

# /etc/fstab に追加
echo "172.16.2.7:/share/videos /mnt/nas/videos nfs defaults,_netdev,rw 0 0" | sudo tee -a /etc/fstab

# マウント
sudo mount -a

# 権限設定
sudo chown -R videoapp:videoapp /mnt/nas/videos
```

### 7.3 NFS パフォーマンス最適化
```bash
# /etc/fstab 最適化オプション
172.16.2.7:/share/videos /mnt/nas/videos nfs rw,hard,intr,rsize=32768,wsize=32768,tcp,timeo=14,_netdev 0 0
```

## 8. GPU 変換サーバー設定

### 8.1 NVIDIA ドライバー・CUDA インストール
```bash
# NVIDIA ドライバー インストール
sudo apt update
sudo apt install -y nvidia-driver-535

# CUDA インストール
wget https://developer.download.nvidia.com/compute/cuda/12.2/local_installers/cuda_12.2_535.54.03_linux.run
sudo sh cuda_12.2_535.54.03_linux.run
```

### 8.2 FFmpeg with GPU サポート
```bash
# 依存関係インストール
sudo apt install -y build-essential pkg-config nasm yasm

# FFmpeg ビルド（NVENC サポート）
git clone https://git.ffmpeg.org/ffmpeg.git
cd ffmpeg
./configure --enable-cuda-nvcc --enable-cuvid --enable-nvenc --enable-nonfree --enable-libnpp --extra-cflags=-I/usr/local/cuda/include --extra-ldflags=-L/usr/local/cuda/lib64
make -j$(nproc)
sudo make install
```

### 8.3 変換サービス設定
```python
# /opt/transcoding/app.py
from flask import Flask, request, jsonify
import subprocess
import os
import logging

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

@app.route('/transcode', methods=['POST'])
def transcode_video():
    data = request.json
    input_path = data.get('input_path')
    output_path = data.get('output_path')
    
    # AV1 エンコードコマンド
    cmd = [
        '/usr/local/bin/ffmpeg',
        '-hwaccel', 'cuda',
        '-i', input_path,
        '-c:v', 'av1_nvenc',
        '-crf', '30',
        '-b:v', '2M',
        '-maxrate', '4M',
        '-bufsize', '8M',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        output_path
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)
        if result.returncode == 0:
            return jsonify({'status': 'success', 'output': output_path})
        else:
            return jsonify({'status': 'error', 'message': result.stderr}), 500
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
```

## 9. 監視・ログ設定

### 9.1 Prometheus + Grafana
```yaml
# docker-compose.yml (監視サーバー)
version: '3.8'
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    volumes:
      - grafana_data:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin

volumes:
  prometheus_data:
  grafana_data:
```

### 9.2 ログ集約 (rsyslog)
```conf
# /etc/rsyslog.d/50-video-platform.conf
# アプリケーションログ
:programname, isequal, "video-platform" /var/log/video-platform/app.log
& stop

# Nginx ログ
$ModLoad imfile
$InputFileName /var/log/nginx/access.log
$InputFileTag nginx-access:
$InputFileStateFile access-log
$InputFileSeverity info
$InputFileFacility local6
$InputRunFileMonitor

# ログローテーション
/var/log/video-platform/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 videoapp videoapp
    postrotate
        systemctl reload rsyslog > /dev/null 2>&1 || true
    endscript
}
```

## 10. セキュリティ設定

### 10.1 ファイアウォール設定
```bash
# UFW 基本設定
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Load Balancer
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Web Servers
sudo ufw allow from 172.16.1.173 to any port 3000

# Database
sudo ufw allow from 172.16.1.174 to any port 5432
sudo ufw allow from 172.16.1.175 to any port 5432

# Redis
sudo ufw allow from 172.16.1.174 to any port 6379
sudo ufw allow from 172.16.1.175 to any port 6379

# SSH (管理用)
sudo ufw allow ssh

# UFW 有効化
sudo ufw enable
```

### 10.2 Fail2Ban 設定
```ini
# /etc/fail2ban/jail.local
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log

[nginx-http-auth]
enabled = true
port = http,https
filter = nginx-http-auth
logpath = /var/log/nginx/error.log

[video-platform]
enabled = true
port = http,https
filter = video-platform
logpath = /var/log/video-platform/app.log
maxretry = 10
```

### 10.3 Google Translate ウィジェット設定（**新規追加**）

#### CSP (Content Security Policy) 設定
```nginx
# /etc/nginx/sites-available/video-platform
add_header Content-Security-Policy "
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval' 
               https://translate.google.com 
               https://translate.googleapis.com;
    style-src 'self' 'unsafe-inline' 
              https://translate.googleapis.com;
    img-src 'self' data: 
            https://translate.googleapis.com;
    connect-src 'self' 
                https://translate.googleapis.com;
    frame-src https://translate.googleapis.com;
" always;
```

#### ファイアウォール設定追加
```bash
# 外部API通信許可（組織のファイアウォール設定）
# Google Translate API へのHTTPS通信を許可
sudo ufw allow out 443/tcp
sudo ufw allow out to translate.google.com port 443
sudo ufw allow out to translate.googleapis.com port 443
```

#### 環境変数設定
```bash
# /var/www/video-platform/.env.production
# Google Translate 設定
GOOGLE_TRANSLATE_ENABLED=true
GOOGLE_TRANSLATE_PAGE_LANGUAGE=ja
GOOGLE_TRANSLATE_INCLUDED_LANGUAGES=en,ko,zh-CN,zh-TW,th,vi,es,fr,de
```

#### Next.js 設定更新
```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // CSP設定
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://translate.google.com https://translate.googleapis.com",
              "style-src 'self' 'unsafe-inline' https://translate.googleapis.com",
              "img-src 'self' data: https://translate.googleapis.com",
              "connect-src 'self' https://translate.googleapis.com",
              "frame-src https://translate.googleapis.com"
            ].join('; ')
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
```

## 11. デプロイメント自動化
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to servers
        run: |
          echo "$SSH_PRIVATE_KEY" > private_key
          chmod 600 private_key
          
          # Web Server 1
          ssh -i private_key -o StrictHostKeyChecking=no ubuntu@172.16.1.174 '
            cd /var/www/video-platform &&
            git pull origin main &&
            npm ci --production &&
            npm run build &&
            pm2 reload ecosystem.config.js
          '
          
          # Web Server 2
          ssh -i private_key -o StrictHostKeyChecking=no ubuntu@172.16.1.175 '
            cd /var/www/video-platform &&
            git pull origin main &&
            npm ci --production &&
            npm run build &&
            pm2 reload ecosystem.config.js
          '
        env:
          SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
```

### 11.2 ヘルスチェック
```bash
#!/bin/bash
# /opt/scripts/health-check.sh

SERVERS=("172.16.1.174:3000" "172.16.1.175:3000")
SLACK_WEBHOOK="https://hooks.slack.com/services/..."

for server in "${SERVERS[@]}"; do
    if ! curl -f http://${server}/health > /dev/null 2>&1; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 Server ${server} is down!\"}" \
            ${SLACK_WEBHOOK}
    fi
done
```

---
**設計版数**: 1.0  
**作成日**: 2025年6月3日