# Audio Quality Analysis

## 概要

RTX 4070Ti Complete Video Transcoderの音声品質分析システムについて説明します。AV1エンコーダーに特化した動画変換システムにおける音声処理の詳細な仕様と品質分析機能を解説します。

## 音声処理アーキテクチャ

### 音声処理フロー

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Input Audio   │    │   Audio Analysis│    │   Audio Codec   │
│                 │    │                 │    │                 │
│ - MP3, AAC      │───►│ - Bitrate       │───►│ - AAC Encoder   │
│ - WAV, FLAC     │    │ - Sample Rate   │    │ - 96-128kbps    │
│ - AC3, DTS      │    │ - Channels      │    │ - 48kHz         │
│ - Opus, Vorbis  │    │ - Duration      │    │ - Stereo        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Quality       │    │   Progress      │    │   Output Audio  │
│   Metrics       │    │   Monitoring    │    │                 │
│                 │    │                 │    │                 │
│ - SNR           │    │ - Real-time     │    │ - AAC (128kbps) │
│ - Dynamic Range │    │ - Bitrate       │    │ - 48kHz Stereo  │
│ - Frequency     │    │ - Quality       │    │ - Fast Start    │
│ - Loudness      │    │ - ETA           │    │ - Compatibility │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 音声品質分析コンポーネント

#### 1. 音声解析エンジン
- **技術**: FFprobe + カスタム解析
- **機能**: メタデータ抽出、品質分析
- **出力**: JSON形式の詳細情報

#### 2. 品質メトリクス計算
- **SNR計算**: 信号対雑音比
- **動的範囲**: 最大・最小音量
- **周波数分析**: スペクトラム分析
- **ラウドネス**: 統合ラウドネス測定

#### 3. リアルタイム監視
- **進捗取得**: 音声処理の進捗
- **品質監視**: リアルタイム品質チェック
- **エラー検出**: 音声処理エラーの検出

## 音声コーデック仕様

### 入力コーデック対応

#### サポート形式一覧
| コーデック | 拡張子 | 品質 | 用途 |
|-----------|--------|------|------|
| AAC | .aac, .m4a | 高 | 標準 |
| MP3 | .mp3 | 中 | 互換性 |
| WAV | .wav | 最高 | 無圧縮 |
| FLAC | .flac | 最高 | ロスレス |
| AC3 | .ac3 | 高 | 映画 |
| DTS | .dts | 高 | 映画 |
| Opus | .opus | 高 | Web |
| Vorbis | .ogg | 高 | Web |

### 出力コーデック仕様

#### libopusエンコーダー設定
```bash
# libopus基本設定
-c:a libopus
-b:a 256k
-ar 48000
-ac 2
-vbr on
-compression_level 10
-application audio
```

#### チャンネル数別ビットレート設定
```javascript
const audioBitrates = {
  '2ch': '320k',            // 2ch以下（ステレオ）
  '5.1ch': '1536k',         // 5.1ch（サラウンド）
  '7.1ch': '2048k'          // 7.1ch以上（マルチチャンネル）
};
```

## 音声品質分析機能

### 1. メタデータ解析

#### FFprobeによる解析
```javascript
const analyzeAudioMetadata = async (inputFile) => {
  const command = `ffprobe -v quiet -print_format json -show_streams -select_streams a:0 ${inputFile}`;
  const result = await execAsync(command);
  const audioInfo = JSON.parse(result.stdout).streams[0];
  
  return {
    codec: audioInfo.codec_name,
    bitrate: parseInt(audioInfo.bit_rate) / 1000,
    sampleRate: audioInfo.sample_rate,
    channels: audioInfo.channels,
    duration: parseFloat(audioInfo.duration),
    language: audioInfo.tags?.language || 'unknown'
  };
};
```

#### 解析結果例
```json
{
  "codec": "aac",
  "bitrate": 128,
  "sampleRate": 48000,
  "channels": 2,
  "duration": 120.5,
  "language": "jpn",
  "quality": "high",
  "dynamicRange": 85.2,
  "snr": 45.8
}
```

### 2. 品質メトリクス計算

#### SNR（信号対雑音比）計算
```javascript
const calculateSNR = (signalPower, noisePower) => {
  if (noisePower === 0) return Infinity;
  return 10 * Math.log10(signalPower / noisePower);
};

const analyzeSNR = async (inputFile) => {
  const command = `ffmpeg -i ${inputFile} -af "volumedetect" -f null - 2>&1`;
  const result = await execAsync(command);
  
  // 音量レベルからSNRを推定
  const meanVolume = parseFloat(result.match(/mean_volume: ([-\d.]+) dB/)?.[1] || 0);
  const maxVolume = parseFloat(result.match(/max_volume: ([-\d.]+) dB/)?.[1] || 0);
  
  return {
    meanVolume,
    maxVolume,
    snr: maxVolume - meanVolume
  };
};
```

#### 動的範囲分析
```javascript
const analyzeDynamicRange = async (inputFile) => {
  const command = `ffmpeg -i ${inputFile} -af "loudnorm=I=-16:TP=-1.5:LRA=11" -f null - 2>&1`;
  const result = await execAsync(command);
  
  const inputI = parseFloat(result.match(/input_I: ([-\d.]+)/)?.[1] || 0);
  const inputTP = parseFloat(result.match(/input_TP: ([-\d.]+)/)?.[1] || 0);
  const inputLRA = parseFloat(result.match(/input_LRA: ([-\d.]+)/)?.[1] || 0);
  
  return {
    integratedLoudness: inputI,
    truePeak: inputTP,
    loudnessRange: inputLRA,
    dynamicRange: inputTP - inputI
  };
};
```

### 3. 周波数分析

#### スペクトラム分析
```javascript
const analyzeFrequencySpectrum = async (inputFile) => {
  const command = `ffmpeg -i ${inputFile} -af "showspectrum=mode=combined:size=1024:color=channel" -f null - 2>&1`;
  const result = await execAsync(command);
  
  // 周波数帯域別のエネルギー分析
  const frequencyBands = {
    low: { min: 20, max: 250 },      // 低域
    mid: { min: 250, max: 4000 },    // 中域
    high: { min: 4000, max: 20000 }  // 高域
  };
  
  return {
    frequencyBands,
    dominantFrequencies: extractDominantFrequencies(result),
    spectralCentroid: calculateSpectralCentroid(result)
  };
};
```

## 進捗取得システム

### 音声処理進捗監視

#### リアルタイム進捗取得
```javascript
// GET /job/:id/progress
{
  "id": "123",
  "progress": 45,
  "state": "active",
  "status": "processing",
  "estimatedTimeRemaining": 120,
  "currentTime": 3000,
  "audioProgress": {
    "codec": "aac",
    "bitrate": 128,
    "quality": "high",
    "processingStage": "encoding"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### 音声処理段階
```javascript
const audioProcessingStages = {
  'analyzing': '音声解析中',
  'encoding': '音声エンコード中',
  'muxing': '音声・動画合成中',
  'finalizing': '最終処理中'
};
```

### 音声品質監視API

#### 音声品質取得
```javascript
// GET /job/:id/audio-quality
{
  "jobId": "123",
  "audioQuality": {
    "inputCodec": "aac",
    "outputCodec": "aac",
    "inputBitrate": 256,
    "outputBitrate": 128,
    "compressionRatio": 50.0,
    "qualityMetrics": {
      "snr": 45.8,
      "dynamicRange": 85.2,
      "loudness": -16.5,
      "frequencyResponse": "flat"
    },
    "processingTime": 15.2
  }
}
```

## 音声処理最適化

### 1. ビットレート最適化

#### 動的ビットレート調整
```javascript
const optimizeAudioBitrate = (audioInfo, preset) => {
  const { duration, channels, sampleRate } = audioInfo;
  
  // チャンネル数に基づくビットレート決定
  if (channels >= 7) {
    return '2048k'; // 7.1ch以上
  } else if (channels >= 5) {
    return '1536k'; // 5.1ch
  } else {
    return '256k'; // 2ch以下
  }
};
```

#### チャンネル数別設定
```javascript
const audioQualityPresets = {
  'stereo': {
    bitrate: '256k',
    sampleRate: 48000,
    channels: 2,
    codec: 'libopus'
  },
  'surround_5_1': {
    bitrate: '1536k',
    sampleRate: 48000,
    channels: 6,
    codec: 'libopus'
  },
  'surround_7_1': {
    bitrate: '2048k',
    sampleRate: 48000,
    channels: 8,
    codec: 'libopus'
  }
};
```

### 2. 音声正規化

#### ラウドネス正規化
```javascript
const normalizeAudio = (inputFile, outputFile) => {
  const command = `ffmpeg -i ${inputFile} \
    -af "loudnorm=I=-16:TP=-1.5:LRA=11" \
    -c:a libopus \
    -b:a 256k \
    -ar 48000 \
    -ac 2 \
    -vbr on \
    -compression_level 10 \
    ${outputFile}`;
    
  return execAsync(command);
};
```

#### 音量調整
```javascript
const adjustVolume = (inputFile, outputFile, volumeDb) => {
  const command = `ffmpeg -i ${inputFile} \
    -af "volume=${volumeDb}dB" \
    -c:a libopus \
    -b:a 256k \
    -vbr on \
    -compression_level 10 \
    ${outputFile}`;
    
  return execAsync(command);
};
```

## 音声品質評価

### 1. 客観的品質指標

#### PESQ（Perceptual Evaluation of Speech Quality）
```javascript
const calculatePESQ = async (referenceFile, processedFile) => {
  // PESQスコア計算（外部ツール使用）
  const command = `pesq +48000 ${referenceFile} ${processedFile}`;
  const result = await execAsync(command);
  
  const pesqScore = parseFloat(result.match(/MOS-LQO:\s*([\d.]+)/)?.[1] || 0);
  
  return {
    pesqScore,
    quality: pesqScore > 4.0 ? 'excellent' : 
             pesqScore > 3.0 ? 'good' : 
             pesqScore > 2.0 ? 'fair' : 'poor'
  };
};
```

#### スペクトラル距離
```javascript
const calculateSpectralDistance = (originalSpectrum, processedSpectrum) => {
  // スペクトラム間の距離計算
  let totalDistance = 0;
  const length = Math.min(originalSpectrum.length, processedSpectrum.length);
  
  for (let i = 0; i < length; i++) {
    totalDistance += Math.abs(originalSpectrum[i] - processedSpectrum[i]);
  }
  
  return totalDistance / length;
};
```

### 2. 主観的品質評価

#### 品質評価スケール
```javascript
const qualityScale = {
  5: 'Excellent - 元音と区別できない',
  4: 'Good - わずかな劣化',
  3: 'Fair - 明らかな劣化',
  2: 'Poor - 大きな劣化',
  1: 'Bad - 使用不可'
};
```

#### 品質評価API
```javascript
// POST /job/:id/quality-feedback
{
  "jobId": "123",
  "qualityRating": 4,
  "comments": "音質は良好ですが、低域が少し弱い",
  "category": "music",
  "duration": 120.5
}
```

## 音声処理エラーハンドリング

### 1. 音声関連エラー

#### エラー分類
```javascript
const audioErrors = {
  'AUDIO_CODEC_NOT_SUPPORTED': 'サポートされていない音声コーデック',
  'AUDIO_BITRATE_TOO_HIGH': '音声ビットレートが高すぎます',
  'AUDIO_CHANNELS_INVALID': '無効なチャンネル数',
  'AUDIO_SAMPLE_RATE_INVALID': '無効なサンプリングレート',
  'AUDIO_DURATION_TOO_LONG': '音声が長すぎます',
  'AUDIO_CORRUPTED': '音声ファイルが破損しています'
};
```

#### エラー回復処理
```javascript
const handleAudioError = async (error, inputFile) => {
  switch (error.code) {
    case 'AUDIO_CODEC_NOT_SUPPORTED':
      return await convertToSupportedCodec(inputFile);
    case 'AUDIO_BITRATE_TOO_HIGH':
      return await reduceBitrate(inputFile);
    case 'AUDIO_CORRUPTED':
      return await repairAudioFile(inputFile);
    default:
      throw error;
  }
};
```

### 2. 音声修復機能

#### 破損ファイル修復
```javascript
const repairAudioFile = async (inputFile) => {
  const command = `ffmpeg -i ${inputFile} \
    -c copy \
    -avoid_negative_ts make_zero \
    -fflags +genpts \
    ${inputFile}.repaired`;
    
  return execAsync(command);
};
```

#### 音声正規化修復
```javascript
const normalizeCorruptedAudio = async (inputFile) => {
  const command = `ffmpeg -i ${inputFile} \
    -af "highpass=f=200,lowpass=f=3000" \
    -c:a libopus \
    -b:a 256k \
    -vbr on \
    -compression_level 10 \
    ${inputFile}.normalized`;
    
  return execAsync(command);
};
```

## 音声処理パフォーマンス

### 1. 処理速度最適化

#### 並列音声処理
```javascript
const parallelAudioProcessing = async (files) => {
  const maxConcurrency = 4;
  const chunks = [];
  
  for (let i = 0; i < files.length; i += maxConcurrency) {
    chunks.push(files.slice(i, i + maxConcurrency));
  }
  
  const results = await Promise.all(
    chunks.map(chunk => 
      Promise.all(chunk.map(file => processAudioFile(file)))
    )
  );
  
  return results.flat();
};
```

#### 音声処理キャッシュ
```javascript
const audioProcessingCache = new Map();

const getCachedAudioInfo = (fileHash) => {
  return audioProcessingCache.get(fileHash);
};

const cacheAudioInfo = (fileHash, audioInfo) => {
  audioProcessingCache.set(fileHash, {
    ...audioInfo,
    timestamp: Date.now()
  });
};
```

### 2. メモリ使用量最適化

#### 音声バッファ管理
```javascript
const audioBufferConfig = {
  maxBufferSize: 1024 * 1024 * 100, // 100MB
  chunkSize: 1024 * 1024 * 10,      // 10MB chunks
  cleanupInterval: 300000             // 5分
};
```

#### 音声処理メモリ監視
```javascript
const monitorAudioMemory = () => {
  const used = process.memoryUsage();
  const audioMemoryUsage = used.heapUsed / 1024 / 1024; // MB
  
  if (audioMemoryUsage > 1000) { // 1GB
    console.warn('音声処理メモリ使用量が高すぎます');
    return false;
  }
  
  return true;
};
```

## 音声品質レポート

### 1. 品質レポート生成

#### 詳細レポート
```javascript
const generateAudioQualityReport = async (jobId) => {
  const audioInfo = await getAudioInfo(jobId);
  const qualityMetrics = await calculateQualityMetrics(jobId);
  
  return {
    jobId,
    timestamp: new Date().toISOString(),
    audioInfo: {
      inputCodec: audioInfo.inputCodec,
      outputCodec: audioInfo.outputCodec,
      inputBitrate: audioInfo.inputBitrate,
      outputBitrate: audioInfo.outputBitrate,
      duration: audioInfo.duration,
      channels: audioInfo.channels,
      sampleRate: audioInfo.sampleRate
    },
    qualityMetrics: {
      snr: qualityMetrics.snr,
      dynamicRange: qualityMetrics.dynamicRange,
      loudness: qualityMetrics.loudness,
      frequencyResponse: qualityMetrics.frequencyResponse
    },
    compression: {
      originalSize: audioInfo.originalSize,
      compressedSize: audioInfo.compressedSize,
      compressionRatio: audioInfo.compressionRatio
    },
    processing: {
      processingTime: audioInfo.processingTime,
      encodingSpeed: audioInfo.encodingSpeed,
      qualityScore: qualityMetrics.overallScore
    }
  };
};
```

### 2. 品質比較レポート

#### 複数ファイル比較
```javascript
const compareAudioQuality = async (files) => {
  const reports = await Promise.all(
    files.map(file => generateAudioQualityReport(file))
  );
  
  return {
    comparison: {
      bestQuality: reports.reduce((best, current) => 
        current.qualityMetrics.overallScore > best.qualityMetrics.overallScore ? current : best
      ),
      averageQuality: reports.reduce((sum, report) => 
        sum + report.qualityMetrics.overallScore, 0
      ) / reports.length,
      qualityDistribution: calculateQualityDistribution(reports)
    },
    recommendations: generateQualityRecommendations(reports)
  };
};
```

## 将来の拡張

### 1. AI音声品質向上

#### 機械学習による最適化
```javascript
const aiAudioOptimization = {
  'noise_reduction': 'AIノイズ除去',
  'voice_enhancement': 'AI音声強調',
  'music_separation': 'AI音楽分離',
  'adaptive_bitrate': 'AI適応ビットレート'
};
```

### 2. リアルタイム音声処理

#### WebRTC対応
```javascript
const realtimeAudioProcessing = {
  'webrtc_audio': 'WebRTC音声処理',
  'live_streaming': 'ライブ配信対応',
  'voice_chat': '音声チャット最適化'
};
```

### 3. 高度な音声分析

#### 音声認識統合
```javascript
const advancedAudioAnalysis = {
  'speech_recognition': '音声認識',
  'emotion_detection': '感情検出',
  'speaker_identification': '話者識別',
  'language_detection': '言語検出'
};
```

この音声品質分析システムにより、AV1エンコーダーに特化した動画変換システムにおいて、高品質な音声処理と詳細な品質分析を実現できます。 