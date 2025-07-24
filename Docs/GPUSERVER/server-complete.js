// =============================================================================
// 設定情報
// =============================================================================

// サーバー設定
const SERVER_CONFIG = {
    PORT: process.env.PORT || 3001,
    MAX_REQUEST_SIZE: '100mb',
    UPLOAD_FILE_SIZE_LIMIT: 10 * 1024 * 1024 * 1024, // 10GB
};

// Redis設定
const REDIS_CONFIG = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379
};

// パス設定
const PATH_CONFIG = {
    NFS_MOUNT: process.env.NFS_MOUNT || '/mnt/nas/videos',
    TEMP_DIR: process.env.TEMP_DIR || '/opt/transcode-temp',
    UPLOAD_DIR: process.env.UPLOAD_DIR || '/mnt/nas/videos/uploads',
    OUTPUT_DIR: process.env.OUTPUT_DIR || '/mnt/nas/videos/converted',
    ORIGINAL_DIR: process.env.ORIGINAL_DIR || '/mnt/nas/videos/original',
    THUMBNAIL_DIR: process.env.THUMBNAIL_DIR || '/mnt/nas/videos/thumbnails',
    HISTORY_FILE: process.env.HISTORY_FILE || './public/job_history.json'
};

// FFmpeg設定
const FFMPEG_CONFIG = {
    FFMPEG_PATH: '/usr/local/bin/ffmpeg',
    FFPROBE_PATH: '/usr/local/bin/ffprobe',
    DEFAULT_THREADS: 4,
    MAX_MUXING_QUEUE_SIZE: 1024
};

// CORS設定
const CORS_OPTIONS = {
    origin: [
        'http://localhost:3000',
        'http://localhost:3001', 
        /^http:\/\/192\.168\.1\.\d+:3000$/,
        /^http:\/\/192\.168\.1\.\d+$/
    ],
    credentials: true
};

// キュー設定
const QUEUE_CONFIG = {
    name: 'video transcoding',
    concurrency: 4,
    defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 20,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 }
    }
};

// キャッシュ設定
const CACHE_CONFIG = {
    METADATA_TTL: 300000 // 5分
};

// サムネイル設定
const THUMBNAIL_CONFIG = {
    DEFAULT_SIZE: '1280x720',
    DEFAULT_TIMESTAMP: 5,
    DEFAULT_FORMAT: 'webp',
    WEBP_QUALITY: 85,
    JPEG_QUALITY: 90
};

// GPU情報
const GPU_INFO = {
    ID: 0,
    MODEL: 'RTX 4070Ti',
    MEMORY: 12282 // MB
};

// 動画プリセット設定（AV1のみ）
const ORIENTATION_PRESETS = {
    'web_4k': {
        videoCodec: 'av1_nvenc',
        outputOptions: ['-pix_fmt yuv420p', '-preset p1', '-rc vbr', '-cq 20', '-maxrate 40M', '-bufsize 80M', '-spatial_aq 1', '-temporal_aq 1', '-gpu 0'],
        description: '4K高品質（AV1、長時間動画対応）'
    },
    'web_2k': {
        videoCodec: 'av1_nvenc', 
        outputOptions: ['-pix_fmt yuv420p', '-preset p2', '-rc vbr', '-cq 22', '-maxrate 20M', '-bufsize 40M', '-spatial_aq 1', '-gpu 0'],
        description: '2K高品質（AV1、長時間動画対応）'
    },
    'web_1080p': {
        videoCodec: 'av1_nvenc',
        outputOptions: ['-pix_fmt yuv420p', '-preset p3', '-rc vbr', '-cq 25', '-maxrate 10M', '-bufsize 20M', '-spatial_aq 1', '-gpu 0'],
        description: '1080p高品質（AV1、長時間動画対応）'
    },
    'web_720p': {
        videoCodec: 'av1_nvenc',
        outputOptions: ['-pix_fmt yuv420p', '-preset p4', '-rc vbr', '-cq 28', '-maxrate 5M', '-bufsize 10M', '-spatial_aq 1', '-gpu 0'],
        description: '720p標準（AV1、長時間動画対応）'
    },
    'portrait_4k': {
        videoCodec: 'av1_nvenc',
        outputOptions: ['-pix_fmt yuv420p', '-preset p1', '-rc vbr', '-cq 20', '-maxrate 30M', '-bufsize 60M', '-spatial_aq 1', '-temporal_aq 1', '-gpu 0'],
        description: '4K縦型高品質（AV1、長時間動画対応）'
    },
    'portrait_2k': {
        videoCodec: 'av1_nvenc',
        outputOptions: ['-pix_fmt yuv420p', '-preset p2', '-rc vbr', '-cq 22', '-maxrate 15M', '-bufsize 30M', '-spatial_aq 1', '-gpu 0'],
        description: '2K縦型高品質（AV1、長時間動画対応）'
    },
    'portrait_1080p': {
        videoCodec: 'av1_nvenc',
        outputOptions: ['-pix_fmt yuv420p', '-preset p3', '-rc vbr', '-cq 25', '-maxrate 8M', '-bufsize 16M', '-spatial_aq 1', '-gpu 0'],
        description: '1080p縦型高品質（AV1、長時間動画対応）'
    },
    'portrait_720p': {
        videoCodec: 'av1_nvenc',
        outputOptions: ['-pix_fmt yuv420p', '-preset p4', '-rc vbr', '-cq 28', '-maxrate 4M', '-bufsize 8M', '-spatial_aq 1', '-gpu 0'],
        description: '720p縦型標準（AV1、長時間動画対応）'
    },
    'preview': {
        videoCodec: 'av1_nvenc',
        outputOptions: ['-pix_fmt yuv420p', '-preset p6', '-rc vbr', '-cq 32', '-maxrate 2M', '-bufsize 4M', '-gpu 0'],
        description: 'プレビュー用（AV1、長時間動画対応）'
    }
};

// =============================================================================
// モジュールインポート
// =============================================================================

const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const Queue = require('bull');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

// =============================================================================
// 初期設定
// =============================================================================

const app = express();
app.use(cors(CORS_OPTIONS));
app.use(express.json({ limit: SERVER_CONFIG.MAX_REQUEST_SIZE }));
app.use(express.static("public"));

ffmpeg.setFfmpegPath(FFMPEG_CONFIG.FFMPEG_PATH);
ffmpeg.setFfprobePath(FFMPEG_CONFIG.FFPROBE_PATH);

// =============================================================================
// グローバル変数
// =============================================================================

const metadataCache = new Map();
const transcodeQueue = new Queue(QUEUE_CONFIG.name, {
    redis: REDIS_CONFIG,
    defaultJobOptions: QUEUE_CONFIG.defaultJobOptions
});

// =============================================================================
// ユーティリティ関数
// =============================================================================

const ensureDir = async (dirPath) => {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') throw error;
    }
};

const safeParseNumber = (value, defaultValue = 0) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : defaultValue;
};

const sanitizePath = (userPath) => {
    const normalized = path.normalize(userPath);
    return normalized.replace(/^(\.\.(\/|\\|$))+/g, '');
};

const getFileSizeMB = async (filePath) => {
    try {
        const stats = await fs.stat(filePath);
        return parseFloat((stats.size / 1024 / 1024).toFixed(2));
    } catch (error) {
        console.error('ファイルサイズ取得エラー:', error);
        return 0;
    }
};

const cleanupTempFiles = async (tempInputFile, tempOutputFile) => {
    try {
        await Promise.all([
            fs.unlink(tempInputFile).catch(() => {}),
            fs.unlink(tempOutputFile).catch(() => {})
        ]);
    } catch (error) {
        console.error('一時ファイル削除エラー:', error);
    }
};

// =============================================================================
// 履歴管理関数
// =============================================================================

const createEmptyHistory = () => ({
    jobs: [],
    stats: {
        totalJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        totalInputSizeMB: 0,
        totalOutputSizeMB: 0,
        totalSavedSizeMB: 0,
        averageCompressionRate: 0,
        totalProcessingTime: 0,
        averageProcessingTime: 0
    },
    lastUpdated: new Date().toISOString()
});

const initializeHistoryFile = async () => {
    try {
        const historyDir = path.dirname(PATH_CONFIG.HISTORY_FILE);
        await ensureDir(historyDir);
        
        const exists = await fs.access(PATH_CONFIG.HISTORY_FILE).then(() => true).catch(() => false);
        if (!exists) {
            const initialHistory = createEmptyHistory();
            await fs.writeFile(PATH_CONFIG.HISTORY_FILE, JSON.stringify(initialHistory, null, 2));
            console.log(`履歴ファイル作成: ${PATH_CONFIG.HISTORY_FILE}`);
        }
    } catch (error) {
        console.error('履歴ファイル初期化エラー:', error);
    }
};

const loadJobHistory = async () => {
    try {
        const exists = await fs.access(PATH_CONFIG.HISTORY_FILE).then(() => true).catch(() => false);
        if (exists) {
            const data = await fs.readFile(PATH_CONFIG.HISTORY_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('履歴ファイル読み込みエラー:', error);
    }
    return createEmptyHistory();
};

const addJobToHistory = async (jobData) => {
    try {
        const history = await loadJobHistory();
        history.jobs.unshift(jobData);
        
        if (history.jobs.length > 1000) {
            history.jobs = history.jobs.slice(0, 1000);
        }
        
        const completedJobs = history.jobs.filter(job => job.status === 'completed');
        const failedJobs = history.jobs.filter(job => job.status === 'failed');
        
        history.stats = {
            totalJobs: history.jobs.length,
            completedJobs: completedJobs.length,
            failedJobs: failedJobs.length,
            totalInputSizeMB: completedJobs.reduce((sum, job) => sum + (job.inputSizeMB || 0), 0),
            totalOutputSizeMB: completedJobs.reduce((sum, job) => sum + (job.outputSizeMB || 0), 0),
            totalSavedSizeMB: completedJobs.reduce((sum, job) => sum + ((job.inputSizeMB || 0) - (job.outputSizeMB || 0)), 0),
            averageCompressionRate: completedJobs.length > 0 ? 
                (completedJobs.reduce((sum, job) => sum + (parseFloat(job.compressionRate) || 0), 0) / completedJobs.length).toFixed(1) : 0,
            totalProcessingTime: completedJobs.reduce((sum, job) => sum + (job.processingTime || 0), 0),
            averageProcessingTime: completedJobs.length > 0 ? 
                (completedJobs.reduce((sum, job) => sum + (job.processingTime || 0), 0) / completedJobs.length).toFixed(1) : 0
        };
        
        history.lastUpdated = new Date().toISOString();
        await fs.writeFile(PATH_CONFIG.HISTORY_FILE, JSON.stringify(history, null, 2));
    } catch (error) {
        console.error('履歴ファイル保存エラー:', error);
    }
};

// =============================================================================
// 動画処理関数
// =============================================================================

const getVideoMetadata = async (filePath) => {
    const safePath = sanitizePath(filePath);
    
    try {
        await fs.access(safePath);
    } catch (error) {
        console.error(`ファイルが見つかりません: ${safePath}`);
        return null;
    }
    
    if (metadataCache.has(safePath)) {
        const cached = metadataCache.get(safePath);
        if (Date.now() - cached.timestamp < CACHE_CONFIG.METADATA_TTL) {
            return cached.data;
        }
    }

    try {
        const metadata = await new Promise((resolve, reject) => {
            // FLVファイルの場合は特別なオプションを追加
            const isFLV = safePath.toLowerCase().endsWith('.flv');
            const ffprobeOptions = isFLV ? ['-analyzeduration', '10M', '-probesize', '10M'] : [];
            
            ffmpeg.ffprobe(safePath, ffprobeOptions, (err, data) => {
                err ? reject(err) : resolve(data);
            });
        });

        if (!metadata || !metadata.format || !metadata.streams) {
            console.error(`無効なメタデータ: ${safePath}`);
            console.error(`メタデータ内容:`, JSON.stringify(metadata, null, 2));
            return null;
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
        
        if (!videoStream) {
            console.error(`動画ストリームが見つかりません: ${safePath}`);
            console.error(`利用可能なストリーム:`, metadata.streams.map(s => ({ type: s.codec_type, codec: s.codec_name })));
            return null;
        }

        const calculateFrameRate = (rFrameRate) => {
            if (!rFrameRate) return null;
            const parts = rFrameRate.split('/');
            if (parts.length === 2) {
                const num = safeParseNumber(parts[0]);
                const den = safeParseNumber(parts[1]);
                return den > 0 ? num / den : null;
            }
            return null;
        };

        const calculateAspectRatio = (width, height, displayAspectRatio) => {
            if (displayAspectRatio) return displayAspectRatio;
            if (width && height && width > 0 && height > 0) {
                const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
                const divisor = gcd(width, height);
                return `${width / divisor}:${height / divisor}`;
            }
            return null;
        };

        const result = {
            duration: safeParseNumber(metadata.format.duration),
            format: {
                format_name: metadata.format.format_name,
                bitrate: safeParseNumber(metadata.format.bit_rate),
                size: safeParseNumber(metadata.format.size),
                tags: metadata.format.tags || {}
            },
            video: videoStream ? {
                codec_name: videoStream.codec_name || 'unknown',
                codec_long_name: videoStream.codec_long_name || 'unknown',
                width: safeParseNumber(videoStream.width),
                height: safeParseNumber(videoStream.height),
                bitrate: safeParseNumber(videoStream.bit_rate),
                frame_rate: calculateFrameRate(videoStream.r_frame_rate),
                pixel_format: videoStream.pix_fmt || 'unknown',
                aspect_ratio: calculateAspectRatio(
                    safeParseNumber(videoStream.width), 
                    safeParseNumber(videoStream.height), 
                    videoStream.display_aspect_ratio
                ),
                color_space: videoStream.color_space || 'unknown',
                color_transfer: videoStream.color_transfer || 'unknown',
                color_primaries: videoStream.color_primaries || 'unknown',
                profile: videoStream.profile || 'unknown',
                level: videoStream.level || 'unknown',
                time_base: videoStream.time_base || 'unknown',
                start_time: safeParseNumber(videoStream.start_time),
                nb_frames: safeParseNumber(videoStream.nb_frames)
            } : null,
            audio: audioStream ? {
                codec_name: audioStream.codec_name || 'unknown',
                codec_long_name: audioStream.codec_long_name || 'unknown',
                bitrate: safeParseNumber(audioStream.bit_rate),
                sample_rate: safeParseNumber(audioStream.sample_rate),
                channels: safeParseNumber(audioStream.channels),
                channel_layout: audioStream.channel_layout || 'unknown',
                sample_fmt: audioStream.sample_fmt || 'unknown',
                profile: audioStream.profile || 'unknown',
                time_base: audioStream.time_base || 'unknown',
                start_time: safeParseNumber(audioStream.start_time),
                nb_frames: safeParseNumber(audioStream.nb_frames)
            } : null,
            streams: metadata.streams.map(stream => ({
                codec_type: stream.codec_type,
                codec_name: stream.codec_name || 'unknown',
                width: safeParseNumber(stream.width),
                height: safeParseNumber(stream.height),
                bitrate: safeParseNumber(stream.bit_rate),
                sample_rate: safeParseNumber(stream.sample_rate),
                channels: safeParseNumber(stream.channels),
                profile: stream.profile || 'unknown',
                level: stream.level || 'unknown',
                time_base: stream.time_base || 'unknown',
                start_time: safeParseNumber(stream.start_time),
                nb_frames: safeParseNumber(stream.nb_frames)
            }))
        };

        if (!result.duration || result.duration <= 0) {
            console.warn(`動画の長さが無効です: ${safePath}, duration: ${result.duration}`);
        }

        console.log(`✅ メタデータ取得成功: ${safePath}`);
        console.log(`  - Duration: ${result.duration}s`);
        if (result.video) {
            console.log(`  - Video: ${result.video.width}x${result.video.height}, ${result.video.frame_rate}fps, ${result.video.codec_name}`);
        }
        if (result.audio) {
            console.log(`  - Audio: ${result.audio.codec_name}, ${result.audio.sample_rate}Hz, ${result.audio.channels}ch`);
        }

        metadataCache.set(safePath, {
            timestamp: Date.now(),
            data: result
        });

        return result;
    } catch (error) {
        console.error(`メタデータ取得エラー: ${safePath}`, error.message);
        console.error(`エラー詳細:`, error.stack);
        return null;
    }
};

// サムネイル生成関数（統合版）
const generateThumbnail = async (inputFile, outputPath, timestamp = THUMBNAIL_CONFIG.DEFAULT_TIMESTAMP, metadata = null, format = THUMBNAIL_CONFIG.DEFAULT_FORMAT, customSize = null) => {
    try {
        // WebP形式の場合はsharpを使用
        if (format === 'webp') {
            return await generateWebPThumbnail(inputFile, outputPath, timestamp, metadata, customSize);
        }
        
        const thumbnailDir = path.dirname(outputPath);
        await ensureDir(thumbnailDir);
        
        if (!fsSync.existsSync(inputFile)) {
            console.error(`❌ 入力ファイルが見つかりません: ${inputFile}`);
            return null;
        }
        
        let thumbnailSize = customSize || THUMBNAIL_CONFIG.DEFAULT_SIZE;
        let videoFilters = [];
        
        // メタデータに基づく自動サイズ判定
        if (!customSize && metadata && metadata.streams) {
            const videoStream = metadata.streams.find(s => s.codec_type === 'video');
            if (videoStream && videoStream.width && videoStream.height) {
                const aspectRatio = videoStream.width / videoStream.height;
                const isPortrait = aspectRatio < 1.0;
                
                if (isPortrait) {
                    thumbnailSize = '720x1280';
                    // 縦型動画の場合はスケーリングせずに直接720x1280を使用
                    videoFilters.push('scale=720:1280');
                    console.log(`📱 縦型動画検出: ${videoStream.width}x${videoStream.height} → サムネイル: ${thumbnailSize} (スケーリングなし)`);
                } else {
                    thumbnailSize = '1280x720';
                    // 横型動画の場合は従来通りアスペクト比を保持
                    videoFilters.push(`scale=${thumbnailSize}:force_original_aspect_ratio=decrease`);
                }
            }
        }
        
        // スケーリングフィルターを追加（縦型動画の場合は既に追加済み）
        if (videoFilters.length === 0) {
            videoFilters.push(`scale=${thumbnailSize}:force_original_aspect_ratio=decrease`);
        }
        
        return new Promise((resolve, reject) => {
            const command = ffmpeg(inputFile)
                .seekInput(timestamp)
                .frames(1)
                .size(thumbnailSize);
            
            // フォーマット別の出力オプション
            const outputOptions = ['-strict', 'unofficial'];
            if (format === 'jpg' || format === 'jpeg') {
                outputOptions.push('-q:v', THUMBNAIL_CONFIG.JPEG_QUALITY.toString());
            } else if (format === 'png') {
                outputOptions.push('-c:v', 'png');
            }
            
            // ビデオフィルターを適用
            if (videoFilters.length > 0) {
                outputOptions.push('-vf', videoFilters.join(','));
            }
            
            command.outputOptions(outputOptions)
                .output(outputPath)
                .on('end', () => {
                    const mode = customSize ? 'カスタム' : '自動';
                    console.log(`✅ サムネイル生成完了: ${path.basename(outputPath)} (${thumbnailSize}, ${format}, ${mode})`);
                    resolve(outputPath);
                })
                .on('error', (err) => {
                    console.error(`❌ サムネイル生成エラー:`, err.message);
                    resolve(null);
                })
                .run();
        });
    } catch (error) {
        console.error(`⚠️ サムネイル生成失敗:`, error.message);
        return null;
    }
};

// WebPサムネイル生成（sharp使用）
const generateWebPThumbnail = async (inputFile, outputPath, timestamp = THUMBNAIL_CONFIG.DEFAULT_TIMESTAMP, metadata = null, customSize = null) => {
    try {
        const thumbnailDir = path.dirname(outputPath);
        await ensureDir(thumbnailDir);
        
        if (!fsSync.existsSync(inputFile)) {
            console.error(`❌ 入力ファイルが見つかりません: ${inputFile}`);
            return null;
        }
        
        // メタデータから縦横判定
        let isPortrait = false;
        if (metadata && metadata.streams) {
            const videoStream = metadata.streams.find(s => s.codec_type === 'video');
            if (videoStream && videoStream.width && videoStream.height) {
                isPortrait = videoStream.width < videoStream.height;
            }
        }
        
        const sharpWidth = isPortrait ? 720 : 1280;
        const sharpHeight = isPortrait ? 1280 : 720;
        
        // 縦型動画の場合はスケーリングせずに720x1280をそのまま使用
        const ffmpegVF = isPortrait
            ? 'scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black'  // パディングあり
            : 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black';
        
        const tempJpegPath = path.join(PATH_CONFIG.TEMP_DIR, `temp_thumb_${uuidv4()}.jpg`);
        await ensureDir(PATH_CONFIG.TEMP_DIR);
        
        return new Promise(async (resolve, reject) => {
            try {
                const command = ffmpeg(inputFile)
                    .seekInput(timestamp)
                    .frames(1)
                    .outputOptions([
                        '-q:v', THUMBNAIL_CONFIG.JPEG_QUALITY.toString(),
                        '-strict', 'unofficial',
                        '-vf', ffmpegVF
                    ]);
                
                command.output(tempJpegPath)
                    .on('end', async () => {
                        try {
                            await sharp(tempJpegPath)
                                .resize(sharpWidth, sharpHeight, {
                                    fit: 'contain',
                                    background: { r: 0, g: 0, b: 0, alpha: 1 }
                                })
                                .webp({
                                    quality: THUMBNAIL_CONFIG.WEBP_QUALITY,
                                    effort: 6
                                })
                                .toFile(outputPath);
                            
                            await fs.unlink(tempJpegPath).catch(() => {});
                            console.log(`✅ WebPサムネイル生成完了: ${path.basename(outputPath)} (${sharpWidth}x${sharpHeight})`);
                            resolve(outputPath);
                        } catch (sharpError) {
                            console.error(`❌ sharp変換エラー:`, sharpError.message);
                            try {
                                await fs.copyFile(tempJpegPath, outputPath.replace('.webp', '.jpg'));
                                await fs.unlink(tempJpegPath).catch(() => {});
                                console.log(`⚠️ WebP変換失敗、JPEGにフォールバック: ${path.basename(outputPath).replace('.webp', '.jpg')}`);
                                resolve(outputPath.replace('.webp', '.jpg'));
                            } catch (copyError) {
                                await fs.unlink(tempJpegPath).catch(() => {});
                                reject(copyError);
                            }
                        }
                    })
                    .on('error', async (err) => {
                        await fs.unlink(tempJpegPath).catch(() => {});
                        console.error(`❌ FFmpegサムネイル生成エラー:`, err.message);
                        reject(err);
                    })
                    .run();
            } catch (error) {
                console.error(`❌ WebPサムネイル生成初期化エラー:`, error.message);
                reject(error);
            }
        });
    } catch (error) {
        console.error(`⚠️ WebPサムネイル生成失敗:`, error.message);
        return null;
    }
};

// スマートプリセット選択（AV1のみ）
const smartPresetSelection = (videoMetadata, userHint = null) => {
    if (!videoMetadata || !videoMetadata.streams) {
        console.log('⚠️ メタデータが無効です。デフォルトプリセットを使用します。');
        return 'web_1080p';
    }
    
    const video = videoMetadata.streams.find(s => s.codec_type === 'video');
    if (!video) {
        console.log('⚠️ 動画ストリームが見つかりません。デフォルトプリセットを使用します。');
        return 'web_1080p';
    }
    
    const { width, height } = video;
    const duration = videoMetadata.duration || 0;
    
    if (!width || !height) {
        console.log('⚠️ 動画の寸法が取得できません。デフォルトプリセットを使用します。');
        return 'web_1080p';
    }
    
    const aspectRatio = width / height;
    const isPortrait = aspectRatio < 1.0;
    
    // 解像度判定
    const maxDimension = Math.max(width, height);
    const is4K = maxDimension >= 3840;
    const is2K = maxDimension >= 2048 && maxDimension < 3840;
    const is1080p = maxDimension >= 1080 && maxDimension < 2048;
    const is720p = maxDimension >= 720 && maxDimension < 1080;
    
    console.log(`🎯 AV1エンコーダー選択: ${width}x${height}, 長さ: ${duration.toFixed(1)}秒`);
    
    // 解像度と向きに基づくプリセット選択
    if (is4K) {
        return isPortrait ? 'portrait_4k' : 'web_4k';
    } else if (is2K) {
        return isPortrait ? 'portrait_2k' : 'web_2k';
    } else if (is1080p) {
        return isPortrait ? 'portrait_1080p' : 'web_1080p';
    } else if (is720p) {
        return isPortrait ? 'portrait_720p' : 'web_720p';
    } else {
        return 'preview';
    }
};

// ジョブ結果処理
const processJobResult = async (job, startTime, inputFile, outputFile) => {
    const totalTime = (Date.now() - startTime) / 1000;
    
    // uploadsディレクトリからoriginalディレクトリへの移動
    if (inputFile.includes('/uploads/')) {
        try {
            const originalFileName = job.data.originalName || 'video.mp4';
            const fileExtension = path.extname(originalFileName) || '.mp4';
            const outputFileName = path.basename(outputFile);
            const outputNameWithoutExt = path.parse(outputFileName).name;
            const originalDir = path.join(PATH_CONFIG.ORIGINAL_DIR);
            const originalFileNameWithExt = `${outputNameWithoutExt}_original${fileExtension}`;
            const originalPath = path.join(originalDir, originalFileNameWithExt);
            
            await ensureDir(originalDir);
            await fs.rename(inputFile, originalPath);
            
            console.log(`✅ 元ファイル移動完了 [${job.id}]: ${originalFileNameWithExt}`);
            inputFile = originalPath;
        } catch (moveError) {
            console.error(`⚠️ ファイル移動エラー [${job.id}]:`, moveError.message);
        }
    }
    
    const inputStats = await fs.stat(inputFile);
    const outputStats = await fs.stat(outputFile);
    
    const inputSizeMB = parseFloat((inputStats.size / 1024 / 1024).toFixed(2));
    const outputSizeMB = parseFloat((outputStats.size / 1024 / 1024).toFixed(2));
    const compressionRate = ((inputStats.size - outputStats.size) / inputStats.size * 100).toFixed(1);
    
    const outputMetadata = await getVideoMetadata(outputFile);
    
    console.log(`✅ 変換完了 [${job.id}]: ${path.basename(outputFile)} (${outputSizeMB}MB, ${totalTime.toFixed(1)}s)`);
    
    // サムネイル生成
    let thumbnailPath = null;
    if (job.data.generateThumbnail) {
        try {
            const thumbnailTimestamp = job.data.thumbnailTimestamp || THUMBNAIL_CONFIG.DEFAULT_TIMESTAMP;
            const thumbnailFormat = job.data.thumbnailFormat || THUMBNAIL_CONFIG.DEFAULT_FORMAT;
            const thumbnailFileName = `${path.basename(outputFile, '.mp4')}_thumb.${thumbnailFormat}`;
            const thumbnailOutputPath = path.join(PATH_CONFIG.THUMBNAIL_DIR, thumbnailFileName);
            
            thumbnailPath = await generateThumbnail(outputFile, thumbnailOutputPath, thumbnailTimestamp, outputMetadata, thumbnailFormat);
            
            if (thumbnailPath) {
                console.log(`✅ サムネイル生成成功 [${job.id}]: ${path.basename(thumbnailPath)}`);
            } else {
                console.warn(`⚠️ サムネイル生成失敗 [${job.id}]`);
            }
        } catch (thumbnailError) {
            console.error(`❌ サムネイル生成エラー [${job.id}]:`, thumbnailError.message);
        }
    }
    
    const presetInfo = ORIENTATION_PRESETS[job.data.preset];
    const videoCodec = presetInfo ? presetInfo.videoCodec : 'unknown';
    
    const jobHistoryData = {
        id: job.id,
        status: 'completed',
        originalName: job.data.originalName || path.basename(inputFile),
        preset: job.data.preset,
        videoCodec: videoCodec,
        inputSizeMB: inputSizeMB,
        outputSizeMB: outputSizeMB,
        processingTime: totalTime,
        compressionRate: compressionRate,
        inputMetadata: job.data.inputMetadata,
        outputMetadata: outputMetadata,
        efficiency: (inputStats.size / totalTime / 1024 / 1024).toFixed(2),
        inputFile: inputFile,
        outputFile: outputFile,
        thumbnailPath: thumbnailPath,
        createdAt: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn
    };
    
    await addJobToHistory(jobHistoryData);
    
    return { 
        status: 'completed', 
        outputFile,
        inputSizeMB: inputSizeMB,
        outputSizeMB: outputSizeMB,
        processingTime: totalTime,
        preset: job.data.preset,
        videoCodec: videoCodec,
        compressionRate: compressionRate,
        inputMetadata: job.data.inputMetadata,
        outputMetadata: outputMetadata,
        thumbnailPath: thumbnailPath,
        efficiency: (inputStats.size / totalTime / 1024 / 1024).toFixed(2)
    };
};

// システム状態取得
const getSystemStatus = async () => {
    return new Promise((resolve) => {
        const { exec } = require('child_process');
        
        const commands = [
            'nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw --format=csv,noheader,nounits',
            'nvidia-smi --query-gpu=encoder.stats.sessionCount,encoder.stats.averageFps --format=csv,noheader,nounits',
            'free -m | grep Mem | awk \'{printf "%.1f", $3/$2*100}\'',
            'df /opt/transcode-temp | tail -1 | awk \'{print $5}\' | sed \'s/%//\'',
            'uptime | awk \'{print $(NF-2)}\' | sed \'s/,//\''
        ];
        
        Promise.all(commands.map(cmd => 
            new Promise(resolve => exec(cmd, (err, stdout) => resolve(stdout.trim())))
        )).then(([gpu, encoder, ram, tmpfs, load]) => {
            if (gpu) {
                const [gpuUtil, memUsed, memTotal, temp, powerDraw] = gpu.split(',').map(s => parseInt(s.trim()) || 0);
                const [sessionCount, avgFps] = encoder ? encoder.split(',').map(s => parseInt(s.trim()) || 0) : [0, 0];
                
                resolve({
                    gpu: { 
                        utilization: gpuUtil, 
                        memoryUsed: memUsed, 
                        memoryTotal: memTotal, 
                        temperature: temp,
                        powerDraw: powerDraw,
                        encoderSessions: sessionCount,
                        encoderFps: avgFps
                    },
                    system: { 
                        ramUsage: parseFloat(ram) || 0, 
                        tmpfsUsage: parseInt(tmpfs) || 0, 
                        loadAverage: parseFloat(load) || 0 
                    },
                    timestamp: new Date().toISOString()
                });
            } else {
                resolve({
                    gpu: { 
                        utilization: 0, 
                        memoryUsed: 0, 
                        memoryTotal: GPU_INFO.MEMORY, 
                        temperature: 0,
                        powerDraw: 0,
                        encoderSessions: 0,
                        encoderFps: 0
                    },
                    system: { 
                        ramUsage: 0, 
                        tmpfsUsage: 0, 
                        loadAverage: 0 
                    },
                    timestamp: new Date().toISOString()
                });
            }
        });
    });
};

// =============================================================================
// 音声品質分析・設定関数
// =============================================================================

const determineAudioBitrate = (audioMetadata, preset, userHint = null) => {
    if (!audioMetadata) {
        console.log('⚠️ 音声メタデータがありません。デフォルトビットレートを使用します。');
        return 256; // 2chのデフォルト
    }
    
    const { bitrate, sample_rate, channels, codec_name } = audioMetadata;
    const originalBitrate = bitrate || 0;
    
    console.log(`🎵 音声分析: ${codec_name}, ${originalBitrate}kbps, ${sample_rate}Hz, ${channels}ch`);
    
    // チャンネル数に基づくビットレート決定
    let maxBitrate;
    if (channels >= 7) {
        maxBitrate = 2048; // 7.1ch以上
        console.log(`🎯 7.1ch以上検出: 最大ビットレート ${maxBitrate}kbps`);
    } else if (channels >= 5) {
        maxBitrate = 1536; // 5.1ch
        console.log(`🎯 5.1ch検出: 最大ビットレート ${maxBitrate}kbps`);
    } else {
        maxBitrate = 320; // 2ch以下
        console.log(`🎯 2ch以下: 最大ビットレート ${maxBitrate}kbps`);
    }
    
    const originalBitrateKbps = Math.round(originalBitrate / 1000);
    const finalBitrate = Math.min(originalBitrateKbps, maxBitrate);
    
    console.log(`🎯 音声ビットレート決定: ${originalBitrate}kbps → ${finalBitrate}kbps (${channels}ch)`);
    
    return finalBitrate;
};

const selectAudioCodec = (audioMetadata, preset, userHint = null) => {
    // すべてのプリセットでlibopusを使用
    return 'libopus';
};

const getDefaultAudioCodec = (preset) => {
    // すべてのプリセットでlibopusを使用
    return 'libopus';
};

const generateAudioOptions = (audioCodec, bitrate, audioMetadata = null) => {
    const options = [];
    
    // すべてlibopusを使用
    options.push('-b:a', `${bitrate}k`);
    
    const shouldUseVBR = determineVBRMode(audioMetadata, bitrate);
    if (shouldUseVBR) {
        options.push('-vbr', 'on');
        console.log(`🎵 libopus: VBRモード有効 (${bitrate}kbps)`);
    } else {
        options.push('-vbr', 'off');
        console.log(`🎵 libopus: CBRモード有効 (${bitrate}kbps)`);
    }
    
    options.push('-compression_level', '10');
    
    if (audioMetadata && audioMetadata.channels > 2) {
        options.push('-application', 'audio');
    }
    
    return options;
};

const determineVBRMode = (audioMetadata, bitrate) => {
    if (!audioMetadata) {
        return bitrate >= 128;
    }
    
    const { codec_name, channels, sample_rate } = audioMetadata;
    const originalCodec = codec_name?.toLowerCase();
    
    if (originalCodec && ['flac', 'alac', 'wav', 'pcm'].includes(originalCodec)) {
        return true;
    }
    
    if (originalCodec && ['opus', 'vorbis'].includes(originalCodec)) {
        return true;
    }
    
    if (bitrate >= 128) {
        return true;
    }
    
    if (channels && channels > 2) {
        return true;
    }
    
    if (sample_rate && sample_rate >= 48000) {
        return true;
    }
    
    return false;
};

// =============================================================================
// キューイベントハンドラー
// =============================================================================

transcodeQueue.on('completed', (job) => {
    job.removeOnComplete(true);
});

transcodeQueue.on('failed', async (job) => {
    console.error(`❌ ジョブ失敗 [${job.id}]: ${job.failedReason}`);
    
    try {
        // 失敗ジョブも履歴に追加
        const jobHistoryData = {
            id: job.id,
            status: 'failed',
            originalName: job.data?.originalName || `job_${job.id}.mp4`,
            preset: job.data?.preset || 'auto',
            inputSizeMB: 0,
            outputSizeMB: 0,
            processingTime: job.processedOn ? (Date.now() - job.processedOn) / 1000 : 0,
            compressionRate: null,
            failedReason: job.failedReason,
            inputFile: job.data?.inputFile,
            outputFile: job.data?.outputFile,
            createdAt: job.timestamp,
            processedOn: job.processedOn,
            finishedOn: job.finishedOn
        };
        
        await addJobToHistory(jobHistoryData);
        console.log(`📝 失敗ジョブ履歴追加: ${job.id}`);
    } catch (error) {
        console.error('失敗ジョブ履歴追加エラー:', error);
    }
    
    job.removeOnFail(true);
});

// =============================================================================
// 変換処理
// =============================================================================

transcodeQueue.process('transcode', QUEUE_CONFIG.concurrency, async (job) => {
    const { inputFile, outputFile, preset, originalName, quality_hint } = job.data;
    
    let finalPreset = ORIENTATION_PRESETS[preset];
    if (!finalPreset) {
        throw new Error(`Invalid preset: ${preset}`);
    }

    const tempInputFile = path.join(PATH_CONFIG.TEMP_DIR, `input_${uuidv4()}_${path.basename(inputFile)}`);
    const tempOutputFile = path.join(PATH_CONFIG.TEMP_DIR, `output_${uuidv4()}_${path.basename(outputFile)}`);

    try {
        await ensureDir(PATH_CONFIG.TEMP_DIR);
        await fs.copyFile(inputFile, tempInputFile);

        const inputMetadata = await getVideoMetadata(tempInputFile);
        const startTime = Date.now();
        
        // 動画の長さを取得して進捗計算に使用
        const totalDuration = inputMetadata?.duration || 0;
        let lastProgressUpdate = 0;

        const audioMetadata = inputMetadata?.audio;
        const audioCodec = selectAudioCodec(audioMetadata, preset, quality_hint);
        const audioBitrate = determineAudioBitrate(audioMetadata, preset, quality_hint);
        const audioOptions = generateAudioOptions(audioCodec, audioBitrate, audioMetadata);

        console.log(`🎵 音声設定: ${audioCodec}, ${audioBitrate}kbps`);
        console.log(`📊 変換開始 [${job.id}]: ${path.basename(inputFile)} → ${path.basename(outputFile)}`);

        return new Promise(async (resolve, reject) => {
            // FLVファイルの場合は特別な入力オプションを追加
            const isFLV = tempInputFile.toLowerCase().endsWith('.flv');
            const inputOptions = isFLV ? ['-analyzeduration', '10M', '-probesize', '10M'] : [];
            
            const command = ffmpeg(tempInputFile)
                .inputOptions(inputOptions)
                .videoCodec(finalPreset.videoCodec)
                .audioCodec(audioCodec)
                .outputOptions([
                    ...finalPreset.outputOptions,
                    ...audioOptions,
                    `-threads ${FFMPEG_CONFIG.DEFAULT_THREADS}`,
                    `-max_muxing_queue_size ${FFMPEG_CONFIG.MAX_MUXING_QUEUE_SIZE}`
                ]);

            // 進捗監視機能を追加
            command.on('progress', (progress) => {
                if (totalDuration > 0 && progress.percent) {
                    const currentProgress = Math.round(progress.percent);
                    
                    // 進捗が5%以上変化した場合のみ更新（API負荷軽減）
                    if (currentProgress - lastProgressUpdate >= 5 || currentProgress >= 100) {
                        job.progress(currentProgress);
                        lastProgressUpdate = currentProgress;
                        
                        console.log(`📈 変換進捗 [${job.id}]: ${currentProgress}% (${progress.timemark}/${Math.floor(totalDuration)}s)`);
                    }
                }
            });

            command.on('error', (err) => {
                console.error(`❌ 変換エラー [${job.id}]:`, err.message);
                reject(err);
            });

            command.on('end', async () => {
                try {
                    console.log(`✅ 変換完了 [${job.id}]: ${path.basename(outputFile)}`);
                    
                    // 進捗を100%に設定
                    job.progress(100);
                    
                    await ensureDir(path.dirname(outputFile));
                    await fs.copyFile(tempOutputFile, outputFile);
                    await cleanupTempFiles(tempInputFile, tempOutputFile);

                    const result = await processJobResult(job, startTime, inputFile, outputFile);
                    resolve(result);
                } catch (error) {
                    console.error(`❌ 後処理エラー [${job.id}]:`, error.message);
                    reject(error);
                }
            });

            command.save(tempOutputFile);
        });
    } catch (error) {
        console.error(`❌ 変換処理エラー [${job.id}]:`, error.message);
        await cleanupTempFiles(tempInputFile, tempOutputFile);
        throw error;
    }
});

// =============================================================================
// マルチパート設定
// =============================================================================

const upload = multer({
    dest: PATH_CONFIG.UPLOAD_DIR,
    limits: { fileSize: SERVER_CONFIG.UPLOAD_FILE_SIZE_LIMIT },
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['video/mp4', 'video/avi', 'video/mov', 'video/mkv', 'video/wmv', 'video/webm', 'video/quicktime'];
        if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(mp4|avi|mov|mkv|wmv|webm)$/i)) {
            cb(null, true);
        } else {
            cb(new Error('サポートされていない動画形式です'), false);
        }
    }
});

// =============================================================================
// 共通レスポンスビルダー関数
// =============================================================================

const buildVideoDetails = (stream) => {
    if (!stream) return null;
    return {
        resolution: `${stream.width}x${stream.height}`,
        width: stream.width,
        height: stream.height,
        bitrate: stream.bitrate,
        frameRate: stream.frame_rate,
        codec: stream.codec_name,
        pixelFormat: stream.pixel_format,
        aspectRatio: stream.aspect_ratio
    };
};

const buildAudioDetails = (stream) => {
    if (!stream) return null;
    return {
        codec: stream.codec_name,
        bitrate: stream.bitrate,
        sampleRate: stream.sample_rate,
        channels: stream.channels,
        channelLayout: stream.channel_layout
    };
};

const buildJobDetails = async (job) => {
    const jobData = job.data || {};
    const inputFile = jobData.inputFile;
    const outputFile = jobData.outputFile;
    
    const originalPath = inputFile.replace('/uploads/', '/original/');
    const inputSize = await getFileSizeMB(originalPath) || await getFileSizeMB(inputFile);
    const outputSize = outputFile && job.finishedOn ? await getFileSizeMB(outputFile) : 0;
    const processingTime = job.processedOn && job.finishedOn ? 
        (job.finishedOn - job.processedOn) / 1000 : 0;
    
    let videoMetadata = null;
    if (job.finishedOn && outputFile) {
        videoMetadata = await getVideoMetadata(outputFile);
    }
    
    let status = 'waiting';
    if (job.finishedOn) {
        status = job.failedReason ? 'failed' : 'completed';
    } else if (job.processedOn) {
        status = 'active';
    }
    
    return {
        id: job.id,
        status: status,
        originalName: jobData.originalName || `job_${job.id}.mp4`,
        preset: jobData.preset || 'auto',
        inputSizeMB: inputSize,
        outputSizeMB: outputSize,
        processingTime: processingTime,
        compressionRate: inputSize > 0 && outputSize > 0 ? 
            ((inputSize - outputSize) / inputSize * 100).toFixed(1) : null,
        resolution: videoMetadata ? videoMetadata.resolution : 'unknown',
        duration: videoMetadata ? videoMetadata.duration : 0,
        codec: videoMetadata ? videoMetadata.codec : 'unknown',
        createdAt: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        failedReason: job.failedReason,
        progress: job.progress(),
        gpuId: GPU_INFO.ID,
        gpuModel: GPU_INFO.MODEL,
        inputFile: inputFile,
        outputFile: outputFile
    };
};

// =============================================================================
// APIエンドポイント
// =============================================================================

// 変換依頼
app.post('/transcode', async (req, res) => {
    const { inputFile, outputFile, preset: userPreset = 'auto', metadata, quality_hint } = req.body;
    
    try {
        if (!fsSync.existsSync(inputFile)) {
            return res.status(400).json({ error: '入力ファイルが見つかりません' });
        }

        const videoInfo = await getVideoMetadata(inputFile);
        
        if (!videoInfo) {
            return res.status(400).json({ 
                error: '動画ファイルのメタデータを取得できませんでした。ファイルが破損しているか、サポートされていない形式の可能性があります。',
                inputFile: inputFile
            });
        }

        const videoStream = videoInfo.streams.find(s => s.codec_type === 'video');
        const audioStream = videoInfo.streams.find(s => s.codec_type === 'audio');
        
        const videoDetails = buildVideoDetails(videoInfo.video);
        const audioDetails = buildAudioDetails(videoInfo.audio);

        let finalPreset;
        if (!userPreset || userPreset === 'auto') {
            finalPreset = smartPresetSelection(videoInfo, quality_hint);
        } else {
            if (!ORIENTATION_PRESETS[userPreset]) {
                return res.status(400).json({ 
                    error: `不正なプリセット: ${userPreset}`,
                    availablePresets: Object.keys(ORIENTATION_PRESETS)
                });
            }
            finalPreset = userPreset;
        }

        const systemStatus = await getSystemStatus();
        if (systemStatus.system.tmpfsUsage > 90) {
            return res.status(429).json({ 
                error: 'システムリソースが不足しています。しばらく待ってから再試行してください',
                tmpfsUsage: systemStatus.system.tmpfsUsage 
            });
        }
        
        const job = await transcodeQueue.add('transcode', {
            inputFile,
            outputFile,
            preset: finalPreset,
            originalName: path.basename(inputFile),
            metadata: metadata || {},
            quality_hint: quality_hint || null
        });
        
        // 音声品質分析結果
        const audioAnalysis = audioDetails ? {
            originalCodec: audioDetails.codec,
            originalBitrate: audioDetails.bitrate,
            originalSampleRate: audioDetails.sampleRate,
            originalChannels: audioDetails.channels,
            recommendedBitrate: determineAudioBitrate(audioDetails, finalPreset, quality_hint),
            recommendedCodec: selectAudioCodec(audioDetails, finalPreset, quality_hint)
        } : null;

        res.json({ 
            success: true, 
            jobId: job.id,
            preset: finalPreset,
            autoSelected: !userPreset || userPreset === 'auto',
            videoDetails: videoDetails,
            audioDetails: audioDetails,
            audioAnalysis: audioAnalysis,
            duration: videoInfo.duration,
            systemStatus,
            message: '変換ジョブが追加されました'
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ジョブ状態確認
app.get('/job/:id', async (req, res) => {
    try {
        const job = await transcodeQueue.getJob(req.params.id);
        if (!job) {
            return res.status(404).json({ error: 'ジョブが見つかりません' });
        }
        
        const progress = job.progress();
        const state = await job.getState();
        
        let result = {
            id: job.id,
            progress: progress || 0,
            state,
            data: job.data,
            processedOn: job.processedOn,
            finishedOn: job.finishedOn,
            returnvalue: job.returnvalue,
            // 進捗の詳細情報を追加
            progressDetails: {
                percentage: progress || 0,
                status: getProgressStatus(state, progress),
                estimatedTimeRemaining: calculateEstimatedTimeRemaining(job, progress),
                currentTime: job.processedOn ? Date.now() - job.processedOn : 0
            }
        };

        if (state === 'completed' && job.returnvalue) {
            result.completed = {
                outputFile: job.returnvalue.outputFile,
                outputSize: job.returnvalue.outputSize,
                preset: job.returnvalue.preset,
                processingTime: job.finishedOn - job.processedOn,
                inputSizeMB: job.returnvalue.inputSizeMB,
                compressionRate: job.returnvalue.compressionRate,
                efficiency: job.returnvalue.efficiency
            };
            if (job.returnvalue.thumbnailPath) {
                result.completed.thumbnailPath = job.returnvalue.thumbnailPath;
            }
            if (job.returnvalue.outputMetadata) {
                result.completed.outputMetadata = job.returnvalue.outputMetadata;
                result.completed.videoDetails = buildVideoDetails(job.returnvalue.outputMetadata.video);
                result.completed.audioDetails = buildAudioDetails(job.returnvalue.outputMetadata.audio);
            }
        }

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 進捗ステータス取得関数
const getProgressStatus = (state, progress) => {
    if (state === 'completed') return 'completed';
    if (state === 'failed') return 'failed';
    if (state === 'waiting') return 'waiting';
    if (state === 'active') {
        if (progress === 0) return 'starting';
        if (progress >= 100) return 'finalizing';
        return 'processing';
    }
    return 'unknown';
};

// 推定残り時間計算関数
const calculateEstimatedTimeRemaining = (job, progress) => {
    if (!job.processedOn || progress <= 0 || progress >= 100) {
        return null;
    }
    
    const elapsedTime = Date.now() - job.processedOn;
    const estimatedTotalTime = (elapsedTime / progress) * 100;
    const remainingTime = estimatedTotalTime - elapsedTime;
    
    return Math.max(0, Math.round(remainingTime / 1000)); // 秒単位
};

// キュー統計API
app.get('/queue/stats', async (req, res) => {
    try {
        const stats = await transcodeQueue.getJobCounts();
        const jobs = await transcodeQueue.getJobs(['completed', 'failed', 'active', 'waiting'], 0, 20);
        
        const detailedJobs = await Promise.all(jobs.map(buildJobDetails));
        
        const completedJobs = detailedJobs.filter(job => job.status === 'completed');
        const totalInputSizeMB = completedJobs.reduce((sum, job) => sum + job.inputSizeMB, 0);
        const totalOutputSizeMB = completedJobs.reduce((sum, job) => sum + job.outputSizeMB, 0);
        const totalProcessingTime = completedJobs.reduce((sum, job) => sum + job.processingTime, 0);
        const averageCompressionRate = completedJobs.length > 0 ? 
            ((totalInputSizeMB - totalOutputSizeMB) / totalInputSizeMB * 100).toFixed(1) : 0;
        
        res.json({
            stats: stats,
            recentJobs: detailedJobs,
            summary: {
                totalJobs: detailedJobs.length,
                completedJobs: completedJobs.length,
                totalInputSizeMB: totalInputSizeMB,
                totalOutputSizeMB: totalOutputSizeMB,
                totalSavedSizeMB: totalInputSizeMB - totalOutputSizeMB,
                averageCompressionRate: averageCompressionRate,
                totalProcessingTime: totalProcessingTime,
                averageProcessingTime: completedJobs.length > 0 ? 
                    (totalProcessingTime / completedJobs.length).toFixed(1) : 0
            }
        });
    } catch (error) {
        console.error('キュー統計取得エラー:', error);
        res.status(500).json({ 
            error: error.message,
            stats: { waiting: 0, active: 0, completed: 0, failed: 0 },
            recentJobs: []
        });
    }
});

// 個別ジョブ詳細API
app.get('/job/:id/details', async (req, res) => {
    try {
        const job = await transcodeQueue.getJob(req.params.id);
        if (!job) {
            return res.status(404).json({ error: 'ジョブが見つかりません' });
        }
        
        const jobData = job.data || {};
        const inputFile = jobData.inputFile;
        const outputFile = jobData.outputFile;
        
        const inputSize = inputFile ? await getFileSizeMB(inputFile) : 0;
        const outputSize = outputFile && job.finishedOn ? await getFileSizeMB(outputFile) : 0;
        const processingTime = job.processedOn && job.finishedOn ? 
            (job.finishedOn - job.processedOn) / 1000 : 0;
        
        let inputMetadata = null;
        let outputMetadata = null;
        
        if (inputFile) {
            inputMetadata = await getVideoMetadata(inputFile);
        }
        
        if (outputFile && job.finishedOn) {
            outputMetadata = await getVideoMetadata(outputFile);
        }
        
        res.json({
            id: job.id,
            status: job.finishedOn ? (job.failedReason ? 'failed' : 'completed') : 
                     job.processedOn ? 'active' : 'waiting',
            originalName: jobData.originalName,
            preset: jobData.preset,
            progress: job.progress(),
            files: {
                input: {
                    path: inputFile,
                    sizeMB: inputSize,
                    metadata: inputMetadata
                },
                output: {
                    path: outputFile,
                    sizeMB: outputSize,
                    metadata: outputMetadata
                }
            },
            processing: {
                processingTime: processingTime,
                compressionRate: inputSize > 0 && outputSize > 0 ? 
                    ((inputSize - outputSize) / inputSize * 100).toFixed(1) : null,
                savedSizeMB: inputSize - outputSize,
                efficiency: processingTime > 0 ? (inputSize / processingTime).toFixed(2) : null
            },
            timestamps: {
                createdAt: job.timestamp,
                processedOn: job.processedOn,
                finishedOn: job.finishedOn
            },
            error: job.failedReason,
            result: job.returnvalue
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// システム状態
app.get('/status', async (req, res) => {
    try {
        const systemStatus = await getSystemStatus();
        const queueStatus = await transcodeQueue.getJobCounts();
        
        res.json({
            system: systemStatus,
            queue: queueStatus,
            presets: Object.keys(ORIENTATION_PRESETS),
            capacity: {
                tmpfsUsage: systemStatus.system.tmpfsUsage,
                ramUsage: systemStatus.system.ramUsage,
                gpuUsage: systemStatus.gpu.utilization,
                availableForNewJobs: systemStatus.system.tmpfsUsage < 80
            },
            performance: {
                gpu: `${GPU_INFO.MODEL} ${GPU_INFO.MEMORY / 1024}GB`,
                ram: '64GB',
                tmpfs: '32GB',
                nfs: 'NFSv4.1',
                orientation: 'Portrait & Landscape Support',
                version: 'Complete-API v1.0'
            },
            nfs: fsSync.existsSync(PATH_CONFIG.NFS_MOUNT) ? 'Mounted' : 'Not Mounted'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// プリセット一覧
app.get('/presets', (req, res) => {
    const presetDetails = {};
    for (const [key, preset] of Object.entries(ORIENTATION_PRESETS)) {
        presetDetails[key] = {
            description: preset.description,
            videoCodec: preset.videoCodec
        };
    }
    
    res.json({
        presets: Object.keys(ORIENTATION_PRESETS),
        details: presetDetails
    });
});

// キュー管理
app.delete('/queue/clear', async (req, res) => {
    try {
        await transcodeQueue.clean(0, 'completed');
        await transcodeQueue.clean(0, 'failed');
        res.json({ message: 'キューをクリアしました' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 履歴ファイルからデータ取得API
app.get('/history', async (req, res) => {
    try {
        const { limit = 50, status } = req.query;
        const history = await loadJobHistory();
        
        let jobs = history.jobs;
        
        if (status) {
            jobs = jobs.filter(job => job.status === status);
        }
        
        if (limit) {
            jobs = jobs.slice(0, parseInt(limit));
        }
        
        res.json({
            jobs: jobs,
            stats: history.stats,
            lastUpdated: history.lastUpdated,
            totalJobs: history.jobs.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 履歴ファイル統計API
app.get('/history/stats', async (req, res) => {
    try {
        const history = await loadJobHistory();
        res.json({
            stats: history.stats,
            lastUpdated: history.lastUpdated
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 履歴ファイルクリアAPI
app.delete('/history', async (req, res) => {
    try {
        const initialHistory = createEmptyHistory();
        await fs.writeFile(PATH_CONFIG.HISTORY_FILE, JSON.stringify(initialHistory, null, 2));
        res.json({ message: '履歴ファイルをクリアしました' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ヘルスチェック
app.get('/health', async (req, res) => {
    try {
        const systemStatus = await getSystemStatus();
        res.json({ 
            status: 'OK',
            timestamp: new Date().toISOString(),
            gpu: systemStatus.gpu,
            system: systemStatus.system,
            presets: Object.keys(ORIENTATION_PRESETS),
            nfs: fsSync.existsSync(PATH_CONFIG.NFS_MOUNT) ? 'Mounted' : 'Not Mounted',
            orientation: 'Portrait & Landscape Support',
            version: 'Complete-API v1.0'
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'ERROR',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// サムネイル生成専用API
app.post('/generate-thumbnail', async (req, res) => {
    try {
        const { inputFile, outputPath, timestamp = THUMBNAIL_CONFIG.DEFAULT_TIMESTAMP, size = THUMBNAIL_CONFIG.DEFAULT_SIZE, format = THUMBNAIL_CONFIG.DEFAULT_FORMAT } = req.body;
        
        if (!inputFile || !fsSync.existsSync(inputFile)) {
            return res.status(400).json({ error: '入力ファイルが見つかりません' });
        }
        
        if (!outputPath) {
            return res.status(400).json({ error: '出力パスが指定されていません' });
        }
        
        const outputDir = path.dirname(outputPath);
        await ensureDir(outputDir);
        
        console.log(`📸 サムネイル生成開始: ${path.basename(inputFile)} → ${path.basename(outputPath)} (${format}, ${size})`);
        
        const thumbnailPath = await generateThumbnail(inputFile, outputPath, timestamp, null, format, size);
        
        if (!thumbnailPath) {
            console.error(`❌ サムネイル生成失敗: ${path.basename(inputFile)}`);
            return res.status(500).json({ 
                success: false, 
                error: 'サムネイル生成に失敗しました' 
            });
        }
        
        const thumbnailStats = await fs.stat(outputPath);
        const thumbnailSizeMB = parseFloat((thumbnailStats.size / 1024 / 1024).toFixed(3));
        
        console.log(`✅ サムネイル生成成功: ${path.basename(outputPath)} (${thumbnailSizeMB}MB)`);
        
        res.json({
            success: true,
            thumbnailPath: outputPath,
            thumbnailSizeMB: thumbnailSizeMB,
            timestamp: timestamp,
            size: size,
            format: format,
            message: 'サムネイルが正常に生成されました'
        });
        
    } catch (error) {
        console.error('サムネイル生成APIエラー:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// サムネイル一覧取得API
app.get('/thumbnails', async (req, res) => {
    try {
        if (!fsSync.existsSync(PATH_CONFIG.THUMBNAIL_DIR)) {
            return res.json({ thumbnails: [], totalCount: 0 });
        }
        
        const files = await fs.readdir(PATH_CONFIG.THUMBNAIL_DIR);
        const thumbnails = await Promise.all(files
            .filter(file => file.match(/\.(jpg|jpeg|png|webp)$/i))
            .map(async file => {
                const filePath = path.join(PATH_CONFIG.THUMBNAIL_DIR, file);
                const stats = await fs.stat(filePath);
                return {
                    filename: file,
                    path: filePath,
                    sizeMB: parseFloat((stats.size / 1024 / 1024).toFixed(3)),
                    createdAt: stats.birthtime,
                    modifiedAt: stats.mtime
                };
            })
        );
        
        res.json({
            thumbnails: thumbnails.sort((a, b) => b.modifiedAt - a.modifiedAt),
            totalCount: thumbnails.length,
            directory: PATH_CONFIG.THUMBNAIL_DIR
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 動画詳細メタデータ取得API
app.get('/video/metadata/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await transcodeQueue.getJob(jobId);
        
        if (!job) {
            return res.status(404).json({ error: 'ジョブが見つかりません' });
        }
        
        const jobData = job.data || {};
        const inputFile = jobData.inputFile;
        const outputFile = jobData.outputFile;
        
        let inputMetadata = null;
        let outputMetadata = null;
        
        if (inputFile && fsSync.existsSync(inputFile)) {
            inputMetadata = await getVideoMetadata(inputFile);
        }
        
        if (outputFile && job.finishedOn && fsSync.existsSync(outputFile)) {
            outputMetadata = await getVideoMetadata(outputFile);
        }
        
        const response = {
            jobId: jobId,
            status: job.finishedOn ? (job.failedReason ? 'failed' : 'completed') : 
                     job.processedOn ? 'active' : 'waiting',
            originalName: jobData.originalName,
            preset: jobData.preset,
            timestamps: {
                createdAt: job.timestamp,
                processedOn: job.processedOn,
                finishedOn: job.finishedOn
            }
        };
        
        if (inputMetadata) {
            response.input = {
                file: inputFile,
                duration: inputMetadata.duration,
                format: inputMetadata.format,
                video: buildVideoDetails(inputMetadata.video),
                audio: buildAudioDetails(inputMetadata.audio)
            };
        }
        
        if (outputMetadata) {
            response.output = {
                file: outputFile,
                duration: outputMetadata.duration,
                format: outputMetadata.format,
                video: buildVideoDetails(outputMetadata.video),
                audio: buildAudioDetails(outputMetadata.audio)
            };
        }
        
        if (inputMetadata && outputMetadata) {
            const inputVideo = inputMetadata.video;
            const outputVideo = outputMetadata.video;
            const inputAudio = inputMetadata.audio;
            const outputAudio = outputMetadata.audio;
            
            response.comparison = {
                video: {
                    resolution: {
                        input: inputVideo ? `${inputVideo.width}x${inputVideo.height}` : 'unknown',
                        output: outputVideo ? `${outputVideo.width}x${outputVideo.height}` : 'unknown',
                        change: inputVideo && outputVideo ? 
                            `${inputVideo.width}x${inputVideo.height} → ${outputVideo.width}x${outputVideo.height}` : 'unknown'
                    },
                    bitrate: {
                        input: inputVideo ? inputVideo.bitrate : 0,
                        output: outputVideo ? outputVideo.bitrate : 0,
                        change: inputVideo && outputVideo ? 
                            `${((inputVideo.bitrate - outputVideo.bitrate) / inputVideo.bitrate * 100).toFixed(1)}%` : 'unknown'
                    },
                    codec: {
                        input: inputVideo ? inputVideo.codec_name : 'unknown',
                        output: outputVideo ? outputVideo.codec_name : 'unknown'
                    }
                },
                audio: {
                    bitrate: {
                        input: inputAudio ? inputAudio.bitrate : 0,
                        output: outputAudio ? outputAudio.bitrate : 0,
                        change: inputAudio && outputAudio ? 
                            `${((inputAudio.bitrate - outputAudio.bitrate) / inputAudio.bitrate * 100).toFixed(1)}%` : 'unknown'
                    },
                    sampleRate: {
                        input: inputAudio ? inputAudio.sample_rate : 0,
                        output: outputAudio ? outputAudio.sample_rate : 0
                    },
                    codec: {
                        input: inputAudio ? inputAudio.codec_name : 'unknown',
                        output: outputAudio ? outputAudio.codec_name : 'unknown'
                    }
                }
            };
        }
        
        res.json(response);
        
    } catch (error) {
        console.error('動画メタデータ取得エラー:', error);
        res.status(500).json({ error: error.message });
    }
});

// ファイルパスから直接メタデータ取得API
app.post('/video/metadata', async (req, res) => {
    try {
        const { filePath } = req.body;
        
        if (!filePath) {
            return res.status(400).json({ error: 'ファイルパスが指定されていません' });
        }
        
        if (!fsSync.existsSync(filePath)) {
            return res.status(404).json({ error: 'ファイルが見つかりません' });
        }
        
        const metadata = await getVideoMetadata(filePath);
        
        if (!metadata) {
            return res.status(400).json({ error: 'メタデータの取得に失敗しました' });
        }
        
        const response = {
            file: filePath,
            filename: path.basename(filePath),
            duration: metadata.duration,
            format: metadata.format,
            video: buildVideoDetails(metadata.video),
            audio: buildAudioDetails(metadata.audio),
            streams: metadata.streams.map(stream => ({
                type: stream.codec_type,
                codec: stream.codec_name,
                bitrate: stream.bitrate,
                sampleRate: stream.sample_rate,
                channels: stream.channels,
                width: stream.width,
                height: stream.height
            }))
        };
        
        res.json(response);
        
    } catch (error) {
        console.error('ファイルメタデータ取得エラー:', error);
        res.status(500).json({ error: error.message });
    }
});

// ファイルアップロード + 変換 API
app.post('/upload-and-transcode', upload.single('video'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '動画ファイルがアップロードされていません' });
        }

        const { preset = 'auto', outputPath, generateThumbnail, thumbnailTimestamp, thumbnailFormat, metadata } = req.body;
        
        const uploadedFile = req.file;
        const inputFile = uploadedFile.path;
        
        const outputFileName = `${Date.now()}_converted.mp4`;
        const finalOutputPath = outputPath || path.join(PATH_CONFIG.OUTPUT_DIR, outputFileName);
        
        const videoInfo = await getVideoMetadata(inputFile);
        
        if (!videoInfo) {
            return res.status(400).json({ 
                error: '動画ファイルのメタデータを取得できませんでした。ファイルが破損しているか、サポートされていない形式の可能性があります。',
                inputFile: inputFile
            });
        }

        let finalPreset;
        if (!preset || preset === 'auto') {
            finalPreset = smartPresetSelection(videoInfo, metadata?.quality_hint);
        } else {
            if (!ORIENTATION_PRESETS[preset]) {
                return res.status(400).json({ 
                    error: `不正なプリセット: ${preset}`,
                    availablePresets: Object.keys(ORIENTATION_PRESETS)
                });
            }
            finalPreset = preset;
        }

        const systemStatus = await getSystemStatus();
        if (systemStatus.system.tmpfsUsage > 90) {
            return res.status(429).json({ 
                error: 'システムリソースが不足しています。しばらく待ってから再試行してください',
                tmpfsUsage: systemStatus.system.tmpfsUsage 
            });
        }
        
        const metadataObj = metadata ? JSON.parse(metadata) : {};
        const originalFilename = metadataObj.originalFilename || uploadedFile.originalname || 'video.mp4';
        const videoId = metadataObj.videoId || Date.now().toString();
        
        const shouldGenerateThumbnail = generateThumbnail === true || 
                                      generateThumbnail === 'true' || 
                                      generateThumbnail === 1 || 
                                      generateThumbnail === '1' ||
                                      generateThumbnail === 'yes';
        
        console.log(`📸 サムネイル生成設定: ${generateThumbnail} → ${shouldGenerateThumbnail}`);
        
        const job = await transcodeQueue.add('transcode', {
            inputFile,
            outputFile: finalOutputPath,
            preset: finalPreset,
            originalName: originalFilename,
            videoId: videoId,
            metadata: metadataObj,
            generateThumbnail: shouldGenerateThumbnail,
            thumbnailTimestamp: parseInt(thumbnailTimestamp) || THUMBNAIL_CONFIG.DEFAULT_TIMESTAMP,
            thumbnailFormat: thumbnailFormat || THUMBNAIL_CONFIG.DEFAULT_FORMAT
        });
        
        const videoStream = videoInfo.streams.find(s => s.codec_type === 'video');
        const audioStream = videoInfo.streams.find(s => s.codec_type === 'audio');
        
        const extractedVideoInfo = {
            width: videoStream ? videoStream.width : 0,
            height: videoStream ? videoStream.height : 0,
            duration: videoInfo.duration || 0,
            resolution: videoStream ? `${videoStream.width}x${videoStream.height}` : 'unknown',
            bitrate: videoStream ? videoStream.bitrate : 0,
            frameRate: videoStream && videoStream.r_frame_rate ? 
                safeParseNumber(videoStream.r_frame_rate.split('/')[0]) / safeParseNumber(videoStream.r_frame_rate.split('/')[1]) : 0,
            codec: videoStream ? videoStream.codec_name : 'unknown'
        };
        
        const extractedAudioInfo = audioStream ? {
            codec: audioStream.codec_name,
            bitrate: audioStream.bitrate,
            sampleRate: audioStream.sample_rate,
            channels: audioStream.channels,
            channelLayout: audioStream.channel_layout
        } : null;
        
        res.json({ 
            success: true, 
            jobId: job.id,
            inputFile,
            outputFile: finalOutputPath,
            preset: finalPreset,
            estimatedDuration: extractedVideoInfo.duration,
            videoInfo: extractedVideoInfo,
            audioInfo: extractedAudioInfo,
            systemStatus,
            thumbnailGeneration: shouldGenerateThumbnail,
            progressUrl: `/job/${job.id}/progress`, // 進捗取得用URL
            message: 'ファイルアップロードと変換ジョブが開始されました'
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// 専用進捗取得API（軽量版）
app.get('/job/:id/progress', async (req, res) => {
    try {
        const job = await transcodeQueue.getJob(req.params.id);
        if (!job) {
            return res.status(404).json({ error: 'ジョブが見つかりません' });
        }
        
        const progress = job.progress() || 0;
        const state = await job.getState();
        
        const result = {
            id: job.id,
            progress: progress,
            state: state,
            status: getProgressStatus(state, progress),
            estimatedTimeRemaining: calculateEstimatedTimeRemaining(job, progress),
            currentTime: job.processedOn ? Date.now() - job.processedOn : 0,
            timestamp: new Date().toISOString()
        };
        
        // 完了時は詳細情報も含める
        if (state === 'completed' && job.returnvalue) {
            result.completed = {
                outputFile: job.returnvalue.outputFile,
                outputSize: job.returnvalue.outputSize,
                processingTime: job.finishedOn - job.processedOn,
                compressionRate: job.returnvalue.compressionRate
            };
        }
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// uploadsディレクトリの一時ファイル削除API
app.post('/cleanup-uploads', async (req, res) => {
    try {
        const { filePath } = req.body;
        
        if (!filePath) {
            return res.status(400).json({ 
                success: false, 
                error: 'filePath is required' 
            });
        }
        
        if (!filePath.includes('/uploads/')) {
            return res.status(400).json({ 
                success: false, 
                error: 'File is not in uploads directory' 
            });
        }
        
        console.log(`🗑️ uploadsディレクトリの一時ファイルを削除: ${filePath}`);
        
        if (!fsSync.existsSync(filePath)) {
            console.log(`⚠️ ファイルが見つかりません: ${filePath}`);
            return res.json({ 
                success: true, 
                message: 'File not found (already deleted or moved)',
                filePath: filePath
            });
        }
        
        await fs.unlink(filePath);
        
        console.log(`✅ uploadsディレクトリの一時ファイル削除完了: ${filePath}`);
        
        res.json({ 
            success: true, 
            message: 'File deleted successfully',
            filePath: filePath
        });
        
    } catch (error) {
        console.error('❌ uploadsディレクトリの一時ファイル削除エラー:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to delete file',
            details: error.message
        });
    }
});

// =============================================================================
// サーバー起動
// =============================================================================

app.listen(SERVER_CONFIG.PORT, async () => {
    console.log(`🚀 RTX 4070Ti Complete Video Transcoder listening on port ${SERVER_CONFIG.PORT}`);
    console.log('📱 縦型・横型動画対応プリセット:', Object.keys(ORIENTATION_PRESETS));
    console.log('🔗 NFS Mount:', fsSync.existsSync(PATH_CONFIG.NFS_MOUNT) ? '✅ Connected' : '❌ Not Found');
    console.log('🎯 自動判定機能: 有効');
    console.log('📁 出力ディレクトリ:', PATH_CONFIG.OUTPUT_DIR);
    console.log('📊 ファイルサイズ: メガバイト単位');
    console.log('📝 履歴ファイル:', PATH_CONFIG.HISTORY_FILE);
    console.log('📊 ダッシュボード: http://localhost:' + SERVER_CONFIG.PORT + '/dashboard.html');
    
    await initializeHistoryFile();
});

// 進捗テスト用API（開発・デバッグ用）
app.get('/progress/test/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await transcodeQueue.getJob(jobId);
        
        if (!job) {
            return res.status(404).json({ 
                error: 'ジョブが見つかりません',
                availableJobs: await transcodeQueue.getJobs(['active', 'waiting', 'completed'], 0, 10)
            });
        }
        
        const progress = job.progress() || 0;
        const state = await job.getState();
        const jobData = job.data || {};
        
        res.json({
            jobId: jobId,
            progress: progress,
            state: state,
            status: getProgressStatus(state, progress),
            jobData: {
                inputFile: jobData.inputFile,
                outputFile: jobData.outputFile,
                preset: jobData.preset,
                originalName: jobData.originalName
            },
            timestamps: {
                createdAt: job.timestamp,
                processedOn: job.processedOn,
                finishedOn: job.finishedOn
            },
            estimatedTimeRemaining: calculateEstimatedTimeRemaining(job, progress),
            currentTime: job.processedOn ? Date.now() - job.processedOn : 0,
            debug: {
                hasReturnValue: !!job.returnvalue,
                hasFailedReason: !!job.failedReason,
                progressMethod: typeof job.progress
            }
        });
    } catch (error) {
        res.status(500).json({ 
            error: error.message,
            stack: error.stack
        });
    }
});

// アクティブジョブ一覧API
app.get('/jobs/active', async (req, res) => {
    try {
        const activeJobs = await transcodeQueue.getJobs(['active', 'waiting'], 0, 50);
        
        const jobsWithProgress = await Promise.all(activeJobs.map(async (job) => {
            const progress = job.progress() || 0;
            const state = await job.getState();
            
            return {
                id: job.id,
                progress: progress,
                state: state,
                status: getProgressStatus(state, progress),
                originalName: job.data?.originalName || 'unknown',
                preset: job.data?.preset || 'unknown',
                createdAt: job.timestamp,
                processedOn: job.processedOn,
                estimatedTimeRemaining: calculateEstimatedTimeRemaining(job, progress),
                currentTime: job.processedOn ? Date.now() - job.processedOn : 0
            };
        }));
        
        res.json({
            activeJobs: jobsWithProgress,
            totalActive: jobsWithProgress.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});