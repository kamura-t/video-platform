# GVA Video Platform - PostgreSQLサーバー設定手順書

## サーバー情報

- **IP Address**: 172.16.1.174
- **サーバー仕様**: 8 vCPU, 16GB RAM, 500GB SSD
- **OS**: Ubuntu Server 24.04 LTS
- **役割**: PostgreSQLデータベースサーバー

## セットアップ手順

### 1. 基本システムセットアップ

```bash
# システム更新
sudo apt-get update && sudo apt-get upgrade -y

# 基本ツールのインストール
sudo apt-get install -y curl wget git htop vim ufw fail2ban
```

### 2. ファイアウォール初期設定

```bash
# UFW基本設定
sudo ufw default deny incoming
sudo ufw default allow outgoing

# SSH許可
sudo ufw allow ssh

# PostgreSQL用ポート（内部ネットワークのみ）
sudo ufw allow from 172.16.1.0/24 to any port 5432

# UFW有効化
sudo ufw enable

# 設定確認
sudo ufw status
```

### 3. PostgreSQL 16のインストール

```bash
# PostgreSQLの公式APTリポジトリを追加
sudo apt-get install -y wget ca-certificates
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list

# パッケージリスト更新
sudo apt-get update

# PostgreSQL 16のインストール
sudo apt-get install -y postgresql-16 postgresql-contrib-16 postgresql-client-16

# PostgreSQLサービス開始・自動起動設定
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 状態確認
sudo systemctl status postgresql
```

### 4. PostgreSQL設定調整

#### 4.1 メモリ・パフォーマンス設定

```bash
# PostgreSQL設定ファイル編集
sudo nano /etc/postgresql/16/main/postgresql.conf
```

設定内容（16GBメモリに最適化）：

```ini
# /etc/postgresql/16/main/postgresql.conf

# ネットワーク設定
listen_addresses = '172.16.1.174,localhost'
port = 5432

# メモリ設定（16GB RAM向け最適化）
shared_buffers = 4GB                    # RAM の 25%
effective_cache_size = 12GB             # RAM の 75%
work_mem = 32MB                         # 複数接続を考慮
maintenance_work_mem = 512MB            # メンテナンス作業用
wal_buffers = 64MB                      # WALバッファ

# 接続設定
max_connections = 200                   # 同時接続数
max_prepared_transactions = 100         # プリペアドトランザクション数

# チェックポイント設定
checkpoint_completion_target = 0.9      # チェックポイント完了目標時間
checkpoint_timeout = 15min              # チェックポイント間隔
max_wal_size = 4GB                      # WAL最大サイズ
min_wal_size = 1GB                      # WAL最小サイズ

# パフォーマンス設定
default_statistics_target = 100         # 統計情報の詳細度
random_page_cost = 1.1                  # SSD用設定
effective_io_concurrency = 200          # SSD用並列I/O

# ログ設定
log_destination = 'csvlog'              # CSV形式ログ
logging_collector = on                  # ログ収集有効
log_directory = '/var/log/postgresql'   # ログディレクトリ
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_statement = 'mod'                   # 変更系クエリをログ
log_min_duration_statement = 1000       # 1秒以上のクエリをログ
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h
log_timezone = 'Asia/Tokyo'

log_checkpoints = on                    # チェックポイントをログ
log_connections = on                    # 接続をログ
log_disconnections = on                 # 切断をログ
log_lock_waits = on                     # ロック待機をログ

# 自動VACUUM設定
autovacuum = on                         # 自動VACUUM有効
autovacuum_max_workers = 3              # 自動VACUUMワーカー数
autovacuum_naptime = 1min               # 自動VACUUM実行間隔
```

#### 4.2 セキュリティ・アクセス制御設定

```bash
# pg_hba.conf編集（アクセス制御）
sudo nano /etc/postgresql/16/main/pg_hba.conf
```

設定内容：

```
# /etc/postgresql/16/main/pg_hba.conf

# TYPE  DATABASE        USER            ADDRESS                 METHOD

# "local" is for Unix domain socket connections only
local   all             postgres                                peer
local   all             all                                     peer

# IPv4 local connections:
host    all             all             127.0.0.1/32            md5

# GVA Video Platform用設定
host    gva_video_platform  gva_user    172.16.1.173/32        md5    # Web Server
host    gva_video_platform  gva_user    172.16.1.174/32        md5    # Database Server (local)

# バックアップ用接続（必要に応じて）
host    gva_video_platform  gva_backup  172.16.1.0/24          md5

# 管理用接続
host    all             postgres        172.16.1.0/24           md5

# IPv6 local connections:
host    all             all             ::1/128                 md5
```

### 5. データベース・ユーザー作成

```bash
# PostgreSQLにスーパーユーザーでログイン
sudo -u postgres psql
```

PostgreSQL内で以下のSQL文を実行：

```sql
-- メインデータベース作成
CREATE DATABASE gva_video_platform
    WITH ENCODING='UTF8'
    LC_COLLATE='C'
    LC_CTYPE='C'
    TEMPLATE=template0;

-- アプリケーション用ユーザー作成（強力なパスワードを設定）
CREATE USER gva_user WITH ENCRYPTED PASSWORD 'PQaEU8Gj3vjNTT2T_SecurePass2024!';

-- 権限付与
GRANT ALL PRIVILEGES ON DATABASE gva_video_platform TO gva_user;
ALTER DATABASE gva_video_platform OWNER TO gva_user;

-- バックアップ用ユーザー作成（必要に応じて）
CREATE USER gva_backup WITH ENCRYPTED PASSWORD 'BackupPass_2024_Secure!';
GRANT CONNECT ON DATABASE gva_video_platform TO gva_backup;

-- 接続テスト情報表示
\l
\du

-- PostgreSQL終了
\q
```

### 6. PostgreSQL再起動と動作確認

```bash
# PostgreSQL再起動
sudo systemctl restart postgresql

# PostgreSQL状態確認
sudo systemctl status postgresql

# ログ確認
sudo tail -f /var/log/postgresql/postgresql-*.log

# アプリケーションユーザーで接続テスト
psql -h 172.16.1.174 -U gva_user -d gva_video_platform -c "SELECT version();"

# データベース一覧表示
psql -h 172.16.1.174 -U gva_user -d gva_video_platform -c "\l"
```

### 7. バックアップスクリプト設定

```bash
# バックアップ用ディレクトリ作成
sudo mkdir -p /backup/postgresql
sudo chown postgres:postgres /backup/postgresql

# バックアップスクリプト作成
sudo nano /opt/backup-database.sh
```

バックアップスクリプト内容：

```bash
#!/bin/bash
# PostgreSQL バックアップスクリプト

BACKUP_DIR="/backup/postgresql"
DATABASE="gva_video_platform"
USER="gva_user"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="${DATABASE}_${DATE}.sql"
LOG_FILE="/var/log/postgresql/backup.log"

# ログ関数
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_FILE
}

# バックアップディレクトリ作成
mkdir -p ${BACKUP_DIR}

log "Starting database backup: ${DATABASE}"

# パスワードファイルの確認（事前に設定が必要）
export PGPASSFILE="/home/postgres/.pgpass"

# データベースダンプ実行
pg_dump -h localhost -U ${USER} -d ${DATABASE} -f "${BACKUP_DIR}/${FILENAME}"

if [ $? -eq 0 ]; then
    log "Backup successful: ${FILENAME}"
    
    # 圧縮
    gzip "${BACKUP_DIR}/${FILENAME}"
    log "Backup compressed: ${FILENAME}.gz"
    
    # 古いバックアップ削除（30日以上前）
    find ${BACKUP_DIR} -name "${DATABASE}_*.sql.gz" -mtime +30 -delete
    log "Old backups cleaned up"
    
    # バックアップサイズ確認
    BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${FILENAME}.gz" | cut -f1)
    log "Backup completed successfully. Size: ${BACKUP_SIZE}"
else
    log "ERROR: Backup failed for ${DATABASE}"
    exit 1
fi
```

```bash
# スクリプト実行権限設定
sudo chmod +x /opt/backup-database.sh

# パスワードファイル作成（postgres ユーザーで）
sudo -u postgres nano /home/postgres/.pgpass
```

.pgpass ファイル内容：
```
# hostname:port:database:username:password
172.16.1.174:5432:gva_video_platform:gva_user:PQaEU8Gj3vjNTT2T_SecurePass2024!
```

```bash
# パスワードファイル権限設定
sudo chmod 600 /home/postgres/.pgpass
sudo chown postgres:postgres /home/postgres/.pgpass

# バックアップスクリプトテスト実行
sudo -u postgres /opt/backup-database.sh
```

### 8. 定期バックアップ設定

```bash
# cron設定（postgres ユーザーで）
sudo crontab -u postgres -e
```

cron設定内容：
```bash
# PostgreSQL 定期バックアップ
# 毎日午前2時にバックアップ実行
0 2 * * * /opt/backup-database.sh

# 毎週日曜日午前1時にVACUUM実行
0 1 * * 0 /usr/bin/psql -h localhost -U gva_user -d gva_video_platform -c "VACUUM ANALYZE;"
```

### 9. 監視・メンテナンス設定

```bash
# PostgreSQL監視スクリプト作成
sudo nano /opt/monitor-postgresql.sh
```

監視スクリプト内容：

```bash
#!/bin/bash
# PostgreSQL 監視スクリプト

LOG_FILE="/var/log/postgresql/monitor.log"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_FILE
}

# PostgreSQL稼働状況確認
if ! systemctl is-active --quiet postgresql; then
    log "ERROR: PostgreSQL service is not running"
    # Slackやメール通知をここに追加可能
    exit 1
fi

# 接続テスト
if ! psql -h localhost -U gva_user -d gva_video_platform -c "SELECT 1;" > /dev/null 2>&1; then
    log "ERROR: Cannot connect to database"
    exit 1
fi

# ディスク使用量確認
DISK_USAGE=$(df -h /var/lib/postgresql | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    log "WARNING: Disk usage is ${DISK_USAGE}%"
fi

# データベースサイズ確認
DB_SIZE=$(psql -h localhost -U gva_user -d gva_video_platform -t -c "SELECT pg_size_pretty(pg_database_size('gva_video_platform'));" | xargs)
log "Database size: ${DB_SIZE}"

# 接続数確認
ACTIVE_CONNECTIONS=$(psql -h localhost -U gva_user -d gva_video_platform -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';" | xargs)
log "Active connections: ${ACTIVE_CONNECTIONS}"

log "PostgreSQL monitoring completed successfully"
```

```bash
# スクリプト実行権限設定
sudo chmod +x /opt/monitor-postgresql.sh

# 5分毎に監視実行（postgres ユーザーのcronに追加）
sudo crontab -u postgres -e
```

cron追加設定：
```bash
# PostgreSQL 監視（5分毎）
*/5 * * * * /opt/monitor-postgresql.sh
```

### 10. セキュリティ設定

```bash
# Fail2Ban PostgreSQL用設定
sudo nano /etc/fail2ban/jail.d/postgresql.conf
```

Fail2Ban設定内容：

```ini
[postgresql]
enabled = true
port = 5432
filter = postgresql
logpath = /var/log/postgresql/postgresql-*.log
maxretry = 5
bantime = 3600
findtime = 600
```

```bash
# Fail2Banフィルター作成
sudo nano /etc/fail2ban/filter.d/postgresql.conf
```

フィルター設定：

```ini
[Definition]
failregex = ^.*\[.*\] FATAL:  password authentication failed for user ".*" <HOST>.*$
            ^.*\[.*\] FATAL:  no pg_hba.conf entry for host "<HOST>".*$
ignoreregex =
```

```bash
# Fail2Ban再起動
sudo systemctl restart fail2ban
sudo systemctl status fail2ban
```

### 11. パフォーマンス最適化設定

```bash
# システムレベル設定
sudo nano /etc/sysctl.conf
```

sysctl設定追加：

```ini
# PostgreSQL最適化
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5
kernel.shmmax = 4294967296
kernel.shmall = 1048576
```

```bash
# 設定適用
sudo sysctl -p
```

### 12. ログ設定・確認

```bash
# PostgreSQLログディレクトリ設定
sudo mkdir -p /var/log/postgresql
sudo chown postgres:postgres /var/log/postgresql

# ログローテーション設定
sudo nano /etc/logrotate.d/postgresql
```

ログローテーション設定：

```
/var/log/postgresql/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 640 postgres postgres
    postrotate
        /usr/bin/systemctl reload postgresql || true
    endscript
}
```

### 13. 接続テストと最終確認

```bash
# 各種接続テスト
echo "=== PostgreSQL接続テスト ==="

# ローカル接続
psql -h localhost -U gva_user -d gva_video_platform -c "SELECT 'Local connection OK' as status;"

# リモート接続テスト（Webサーバーから）
psql -h 172.16.1.174 -U gva_user -d gva_video_platform -c "SELECT 'Remote connection OK' as status;"

# データベース情報表示
echo "=== データベース情報 ==="
psql -h localhost -U gva_user -d gva_video_platform -c "\l"
psql -h localhost -U gva_user -d gva_video_platform -c "SELECT version();"

# パフォーマンス設定確認
echo "=== パフォーマンス設定確認 ==="
psql -h localhost -U gva_user -d gva_video_platform -c "SHOW shared_buffers;"
psql -h localhost -U gva_user -d gva_video_platform -c "SHOW effective_cache_size;"
psql -h localhost -U gva_user -d gva_video_platform -c "SHOW work_mem;"

# サービス状態確認
echo "=== サービス状態 ==="
sudo systemctl status postgresql
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. 接続エラー
```bash
# PostgreSQL状態確認
sudo systemctl status postgresql

# ポート確認
sudo netstat -tlnp | grep 5432

# ファイアウォール確認
sudo ufw status
```

#### 2. メモリ不足
```bash
# メモリ使用量確認
free -h
sudo sysctl vm.swappiness

# PostgreSQL設定見直し
sudo nano /etc/postgresql/16/main/postgresql.conf
# shared_buffers, work_mem を調整
```

#### 3. ディスク容量不足
```bash
# ディスク使用量確認
df -h
du -sh /var/lib/postgresql/

# 古いログ削除
sudo find /var/log/postgresql/ -name "*.log" -mtime +7 -delete
```

#### 4. 接続数上限
```bash
# 現在の接続数確認
psql -h localhost -U gva_user -d gva_video_platform -c "SELECT count(*) FROM pg_stat_activity;"

# max_connections設定確認・調整
psql -h localhost -U gva_user -d gva_video_platform -c "SHOW max_connections;"
```

## セットアップ完了チェックリスト

- [ ] PostgreSQL 16インストール完了
- [ ] データベース・ユーザー作成完了
- [ ] ネットワーク設定（listen_addresses）完了
- [ ] アクセス制御（pg_hba.conf）設定完了
- [ ] パフォーマンス設定完了
- [ ] バックアップスクリプト設定・テスト完了
- [ ] 定期バックアップ（cron）設定完了
- [ ] 監視スクリプト設定完了
- [ ] セキュリティ設定（UFW, Fail2Ban）完了
- [ ] ログ設定・ローテーション完了
- [ ] 接続テスト（ローカル・リモート）完了

---

**注意事項:**
- パスワードは例示です。本番環境では必ず強力なパスワードを設定してください
- セキュリティ設定は組織のポリシーに合わせて調整してください
- 定期的な監視とメンテナンスを実施してください