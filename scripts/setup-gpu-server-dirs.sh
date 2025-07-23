#!/bin/bash

# GPU変換サーバー用ディレクトリ設定スクリプト
# このスクリプトはGPU変換サーバー側で実行してください

echo "🔧 GPU変換サーバー用ディレクトリ設定を開始します..."

# 必要なディレクトリを作成
echo "📁 必要なディレクトリを作成中..."
sudo mkdir -p /mnt/nas/videos/uploads
sudo mkdir -p /mnt/nas/videos/converted
sudo mkdir -p /mnt/nas/videos/original
sudo mkdir -p /mnt/nas/videos/thumbnails
sudo mkdir -p /opt/transcode-temp

# 権限を設定
echo "🔐 ディレクトリの権限を設定中..."
sudo chown -R $USER:$USER /mnt/nas/videos
sudo chown -R $USER:$USER /opt/transcode-temp

# 権限を確認
echo "✅ ディレクトリの権限を確認中..."
ls -la /mnt/nas/videos/
ls -la /opt/transcode-temp/

echo "🎉 GPU変換サーバー用ディレクトリ設定が完了しました！"
echo "💡 GPU変換サーバーを再起動してください。" 