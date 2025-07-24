# Redis Server セットアップ手順書（Ubuntu）

## 概要
この手順書では、クリーンインストールされたUbuntuシステムにRedis Serverをインストールし、本番環境での使用に適した設定を行います。

## システム要件
- Ubuntu 20.04 LTS / 22.04 LTS / 24.04 LTS
- 16GB RAM
- 160GBディスク容量
- sudo権限を持つユーザー

## インストール手順

### 1. システムアップデート
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Redis Serverのインストール

#### 方法A: APTパッケージマネージャーを使用（推奨）
```bash
# Redisインストール
sudo apt install redis-server -y

# インストール確認
redis-server --version
```

#### 方法B: 最新版を手動インストール
```bash
# 依存関係のインストール
sudo apt install build-essential tcl wget -y

# Redis最新版をダウンロード
cd /tmp
wget http://download.redis.io/redis-stable.tar.gz
tar xzf redis-stable.tar.gz
cd redis-stable

# コンパイル・インストール
make
make test
sudo make install

# 設定ディレクトリの作成
sudo mkdir -p /etc/redis
sudo mkdir -p /var/lib/redis
sudo useradd --system --home /var/lib/redis --shell /bin/false redis
sudo chown redis:redis /var/lib/redis
sudo chmod 770 /var/lib/redis
```

### 3. Redis設定ファイルの作成・編集

#### 設定ファイルの場所
```bash
sudo nano /etc/redis/redis.conf
```

#### 基本設定（/etc/redis/redis.conf）
```conf
# 基本設定
port 6379
bind 127.0.0.1 172.16.1.175  # ローカルホスト + 内部ネットワーク
protected-mode yes
timeout 0
tcp-keepalive 300

# データベース設定
databases 16
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /var/lib/redis

# ログ設定
loglevel notice
logfile /var/log/redis/redis-server.log
**syslog-enabled yes**
**syslog-ident redis**

# メモリ設定
maxmemory 2gb
maxmemory-policy allkeys-lru
maxmemory-samples 5

# セキュリティ設定
requirepass your_strong_password_here 8u22DNrbeYmH
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command DEBUG ""
rename-command CONFIG "CONFIG_b835729fa8c5a9e2"

# パフォーマンス設定
tcp-backlog 511
timeout 0
tcp-keepalive 300
```

### 4. systemdサービスファイルの作成
```bash
sudo nano /etc/systemd/system/redis.service
```

#### サービス設定内容
```ini
[Unit]
Description=Advanced key-value store
After=network.target
Documentation=http://redis.io/documentation, man:redis-server(1)

[Service]
Type=notify
ExecStart=/usr/local/bin/redis-server /etc/redis/redis.conf
ExecReload=/bin/kill -USR2 $MAINPID
TimeoutStopSec=0
Restart=always
User=redis
Group=redis

# セキュリティ設定
NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=-/var/lib/redis

# リソース制限
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

### 5. ログディレクトリの設定
```bash
sudo mkdir -p /var/log/redis
sudo chown redis:redis /var/log/redis
sudo chmod 755 /var/log/redis
```

### 6. systemdの設定とサービス開始
```bash
# systemdの設定再読み込み
sudo systemctl daemon-reload

# Redisサービスの開始
sudo systemctl start redis

# 自動起動の設定
sudo systemctl enable redis

# サービス状態の確認
sudo systemctl status redis
```

## セキュリティ設定

### 1. ファイアウォール設定
```bash
# UFWの有効化
sudo ufw enable

# 必要なポートのみ開放
sudo ufw allow from 172.16.1.0/24 to any port 6379  # 内部ネットワークのみ
sudo ufw allow from 172.16.2.0/24 to any port 6379  # 内部ネットワークのみ
sudo ufw allow from 172.16.5.0/24 to any port 6379  # 内部ネットワークのみ
sudo ufw allow ssh  # SSH接続用

# 設定確認
sudo ufw status
```

### 2. パスワード設定
```bash
# Redis CLI接続
redis-cli

# 認証テスト
127.0.0.1:6379> AUTH your_strong_password_here
OK

# 設定確認
127.0.0.1:6379> CONFIG GET requirepass
1) "requirepass"
2) "your_strong_password_here"
```

### 3. SSL/TLS設定（推奨）
```bash
# SSL証明書の生成
sudo mkdir -p /etc/redis/ssl
cd /etc/redis/ssl

# 自己署名証明書の作成
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout redis.key -out redis.crt \
  -subj "/C=JP/ST=Tokyo/L=Tokyo/O=GVA/CN=redis.local"

# 権限設定
sudo chown redis:redis /etc/redis/ssl/*
sudo chmod 600 /etc/redis/ssl/redis.key
sudo chmod 644 /etc/redis/ssl/redis.crt
```

#### redis.confにSSL設定を追加
```conf
# SSL/TLS設定
tls-port 6380
port 0  # 非SSL接続を無効化
tls-cert-file /etc/redis/ssl/redis.crt
tls-key-file /etc/redis/ssl/redis.key
tls-ca-cert-file /etc/redis/ssl/redis.crt
tls-protocols "TLSv1.2 TLSv1.3"
```

## パフォーマンス最適化

### 1. カーネルパラメータの調整
```bash
sudo nano /etc/sysctl.conf
```

#### 追加する設定
```conf
# メモリ設定
vm.overcommit_memory = 1
vm.swappiness = 1

# ネットワーク設定
net.core.somaxconn = 65535
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216

# TCP設定
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
```

```bash
# 設定の適用
sudo sysctl -p
```

### 2. メモリ最適化
```bash
# Transparent Huge Pagesの無効化
echo never | sudo tee /sys/kernel/mm/transparent_hugepage/enabled
echo never | sudo tee /sys/kernel/mm/transparent_hugepage/defrag

# 永続化設定
sudo nano /etc/rc.local
```

#### rc.localに追加
```bash
#!/bin/bash
echo never > /sys/kernel/mm/transparent_hugepage/enabled
echo never > /sys/kernel/mm/transparent_hugepage/defrag
exit 0
```

```bash
sudo chmod +x /etc/rc.local
```

## 監視とメンテナンス

### 1. Redis監視スクリプト
```bash
sudo nano /usr/local/bin/redis-monitor.sh
```

#### 監視スクリプト内容
```bash
#!/bin/bash
REDIS_CLI="redis-cli -a your_strong_password_here"

# メモリ使用量チェック
MEMORY_USAGE=$($REDIS_CLI info memory | grep used_memory_human | cut -d: -f2 | tr -d '\r')
echo "Memory Usage: $MEMORY_USAGE"

# 接続数チェック
CONNECTED_CLIENTS=$($REDIS_CLI info clients | grep connected_clients | cut -d: -f2 | tr -d '\r')
echo "Connected Clients: $CONNECTED_CLIENTS"

# キー数チェック
KEYS_COUNT=$($REDIS_CLI dbsize)
echo "Total Keys: $KEYS_COUNT"

# サービス状態チェック
systemctl is-active redis
```

```bash
sudo chmod +x /usr/local/bin/redis-monitor.sh
```

### 2. ログローテーション
```bash
sudo nano /etc/logrotate.d/redis
```

#### ログローテーション設定
```conf
/var/log/redis/*.log {
    weekly
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 0640 redis redis
    postrotate
        systemctl reload redis
    endscript
}
```

### 3. バックアップスクリプト
```bash
sudo nano /usr/local/bin/redis-backup.sh
```

#### バックアップスクリプト内容
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/redis"
DATE=$(date +%Y%m%d_%H%M%S)
REDIS_CLI="redis-cli -a your_strong_password_here"

# バックアップディレクトリの作成
mkdir -p $BACKUP_DIR

# RDB形式でバックアップ
$REDIS_CLI BGSAVE
sleep 10
cp /var/lib/redis/dump.rdb $BACKUP_DIR/dump_$DATE.rdb

# 古いバックアップファイルの削除（7日以上前）
find $BACKUP_DIR -name "dump_*.rdb" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/dump_$DATE.rdb"
```

```bash
sudo chmod +x /usr/local/bin/redis-backup.sh
```

### 4. cron設定
```bash
sudo crontab -e
```

#### cron設定内容
```cron
# Redis日次バックアップ（毎日午前2時）
0 2 * * * /usr/local/bin/redis-backup.sh

# Redis監視（5分毎）
*/5 * * * * /usr/local/bin/redis-monitor.sh >> /var/log/redis/monitor.log 2>&1
```

## 接続テスト

### 1. ローカル接続テスト
```bash
# 基本接続
redis-cli -h 127.0.0.1 -p 6379 -a your_strong_password_here

# 接続確認
127.0.0.1:6379> ping
PONG

# 基本操作テスト
127.0.0.1:6379> set test_key "Hello Redis"
OK
127.0.0.1:6379> get test_key
"Hello Redis"
127.0.0.1:6379> del test_key
(integer) 1
```

### 2. リモート接続テスト
```bash
# 別のサーバーから接続
redis-cli -h 172.16.1.172 -p 6379 -a your_strong_password_here

# SSL接続テスト（SSL設定済みの場合）
redis-cli -h 172.16.1.172 -p 6380 -a your_strong_password_here --tls \
  --cert /path/to/client.crt --key /path/to/client.key \
  --cacert /path/to/ca.crt
```

## アプリケーション連携 (Webサーバー側で設定する)

### 1. Node.js連携設定
```javascript
// package.json
{
  "dependencies": {
    "redis": "^4.6.0"
  }
}

// redis-client.js
const redis = require('redis');

const client = redis.createClient({
  host: '172.16.1.175',
  port: 6379,
  password: 'your_strong_password_here',
  db: 0
});

client.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

module.exports = client;
```

### 2. 環境変数設定(Webサーバー側で設定する)
```env
REDIS_URL=redis://:your_strong_password_here@172.16.1.175:6379
REDIS_HOST=172.16.1.175
REDIS_PORT=6379
REDIS_PASSWORD=your_strong_password_here
REDIS_DB=0
```

## トラブルシューティング

### 1. よくある問題と解決方法

#### 接続エラー
```bash
# サービス状態確認
sudo systemctl status redis

# ログ確認
sudo tail -f /var/log/redis/redis-server.log

# ポート確認
sudo netstat -tlnp | grep 6379
```

#### メモリ不足
```bash
# メモリ使用量確認
redis-cli -a your_strong_password_here info memory

# 設定確認
redis-cli -a your_strong_password_here config get maxmemory
```

#### パフォーマンス問題
```bash
# 遅いクエリ確認
redis-cli -a your_strong_password_here slowlog get 10

# 統計情報確認
redis-cli -a your_strong_password_here info stats
```

### 2. 診断コマンド
```bash
# Redis設定確認
redis-cli -a your_strong_password_here config get "*"

# サーバー情報確認
redis-cli -a your_strong_password_here info

# 接続情報確認
redis-cli -a your_strong_password_here client list
```

## 本番環境での考慮事項

### 1. セキュリティ
- 強力なパスワードの設定
- 不要なコマンドの無効化
- ファイアウォールの適切な設定
- SSL/TLS暗号化の実装

### 2. 高可用性
- Redis Sentinelの設定検討
- レプリケーション設定
- 自動フェイルオーバー

### 3. パフォーマンス
- メモリ使用量の監視
- 定期的なバックアップ
- ログローテーション
- システムリソースの監視

この手順書に従って設定することで、本番環境に適したRedis Serverを構築できます。セキュリティとパフォーマンスの両面で最適化された設定となっています。

動作確認
必要な確認項目:

  1. サービス状態確認
  sudo systemctl status redis

  2. ポート接続確認
  sudo netstat -tlnp | grep 6379

  3. 認証テスト
  redis-cli -h 172.16.1.175 -p 6379
  127.0.0.1:6379> AUTH your_strong_password_here
  OK
  127.0.0.1:6379> PING
  PONG

  4. 基本操作テスト
  127.0.0.1:6379> SET test_key "Hello Redis"
  OK
  127.0.0.1:6379> GET test_key
  "Hello Redis"
  127.0.0.1:6379> DEL test_key
  (integer) 1

  5. リモート接続テスト（Webサーバーから）
  # Webサーバー（172.16.1.173）から実行
  redis-cli -h 172.16.1.175 -p 6379 -a
  your_strong_password_here ping