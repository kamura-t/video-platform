#!/bin/bash

# Nginx 設定スクリプト
# 使用方法: ./scripts/nginx-config.sh your-domain.com

set -e

DOMAIN=$1

if [ -z "$DOMAIN" ]; then
    echo "使用方法: $0 your-domain.com"
    exit 1
fi

echo "🔧 Nginx 設定を作成しています..."

# Nginx 設定ファイルの作成
sudo tee /etc/nginx/sites-available/gva << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    # リダイレクト設定
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    
    # SSL証明書の設定（Let's Encrypt を使用する場合）
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    # SSL設定
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # セキュリティヘッダー
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # クライアント設定
    client_max_body_size 5G;
    client_body_timeout 300s;
    client_header_timeout 300s;
    
    # プロキシ設定
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
    }
    
    # 静的ファイルの配信
    location /_next/static/ {
        alias /var/www/gva/.next/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # アップロードファイルの配信
    location /uploads/ {
        alias /var/www/gva/uploads/;
        expires 1d;
        add_header Cache-Control "public";
    }
    
    # 動画ファイルの配信
    location /videos/ {
        alias /var/www/gva/public/videos/;
        expires 1d;
        add_header Cache-Control "public";
        add_header Accept-Ranges bytes;
    }
    
    # ヘルスチェック
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

# 設定ファイルの有効化
sudo ln -sf /etc/nginx/sites-available/gva /etc/nginx/sites-enabled/

# デフォルトサイトの無効化
sudo rm -f /etc/nginx/sites-enabled/default

# 設定ファイルのテスト
sudo nginx -t

echo "✅ Nginx 設定が完了しました！"
echo "Nginx を再起動するには: sudo systemctl restart nginx"
echo "SSL証明書を取得するには: sudo certbot --nginx -d $DOMAIN" 