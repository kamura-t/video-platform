# ビットレート分析・算出機能 技術仕様書

## 概要

ビットレート分析・算出機能は、動画ファイルの特性を分析し、最適な変換設定を自動的に決定するシステムです。元のビットレートを基準として、解像度、動画タイプ、品質レベルを考慮した動的なビットレート設定を提供します。

## アーキテクチャ

### 1. ビットレート分析エンジン

```javascript
const analyzeBitrate = (videoMetadata) => {
    // 1. 解像度判定
    // 2. 現在のビットレート計算
    // 3. 標準ビットレート比較
    // 4. 品質レベル判定
    // 5. 動画タイプ推定
    // 6. 推奨設定生成
}
```

### 2. 動的プリセット生成エンジン

```javascript
const generateDynamicPreset = (bitrateAnalysis, targetQuality) => {
    // 1. ベースプリセット選択
    // 2. 動的ビットレート設定
    // 3. エンコーダパラメータ調整
    // 4. 品質最適化
}
```

## ビットレート算出アルゴリズム

### 1. 解像度判定ロジック

```javascript
const maxDim = Math.max(width, height);
let resolution = 'unknown';

if (maxDim >= 3840) resolution = '4K';
else if (maxDim >= 2560) resolution = '2K';
else if (maxDim >= 1920) resolution = '1080p';
else if (maxDim >= 1280) resolution = '720p';
else if (maxDim >= 854) resolution = '480p';
else resolution = '360p';
```

**特徴:**
- 最大寸法を基準とした判定
- 縦型動画にも対応
- 解像度の境界値を明確に定義

### 2. 現在のビットレート計算

```javascript
const currentBitrate = bitrate || (fileSize * 8 / duration / 1000); // Kbps
```

**計算式:**
```
ビットレート (Kbps) = (ファイルサイズ (bytes) × 8) ÷ (動画長 (秒) × 1000)
```

**特徴:**
- メタデータのビットレート情報を優先
- フォールバックとしてファイルサイズから計算
- 精度の高いビットレート推定

### 3. 標準ビットレート基準

| 解像度 | 標準ビットレート | 説明 |
|--------|------------------|------|
| 4K     | 8000 Kbps        | 4K動画の標準的なビットレート |
| 2K     | 4000 Kbps        | 2K動画の標準的なビットレート |
| 1080p  | 2000 Kbps        | Full HD動画の標準的なビットレート |
| 720p   | 1000 Kbps        | HD動画の標準的なビットレート |
| 480p   | 500 Kbps         | SD動画の標準的なビットレート |
| 360p   | 250 Kbps         | 低解像度動画の標準的なビットレート |

### 4. ビットレート比率計算

```javascript
const bitrateRatio = currentBitrate / standardBitrate;
```

**比率の意味:**
- `ratio >= 1.5`: 高品質（ビットレートが標準より50%以上高い）
- `0.7 <= ratio < 1.5`: 標準品質
- `ratio < 0.7`: 低品質（ビットレートが標準より30%以上低い）

### 5. 品質レベル判定

```javascript
let qualityLevel = 'standard';
if (bitrateRatio >= 1.5) qualityLevel = 'high';
else if (bitrateRatio <= 0.7) qualityLevel = 'low';
```

**判定基準:**
- **high**: ビットレート比率 ≥ 1.5
- **standard**: 0.7 ≤ ビットレート比率 < 1.5
- **low**: ビットレート比率 < 0.7

### 6. 動画タイプ推定

```javascript
const aspectRatio = width / height;
const isPortrait = aspectRatio < 1.0;
const isStatic = duration > 0 && (fileSize / duration) < 100; // 1秒あたり100KB未満

let contentType = 'normal';
if (isStatic) contentType = 'static';
```

**推定ロジック:**
- **static**: 1秒あたり100KB未満の低ビットレート動画
- **normal**: 通常の動画コンテンツ
- **action**: アクション・スポーツ動画（将来的な拡張）
- **animation**: アニメーション動画（将来的な拡張）

## 動的ビットレート設定

### 1. 品質レベル別倍率

```javascript
const QUALITY_MULTIPLIERS = {
    'high': 1.5,     // 高品質: 1.5倍
    'standard': 1.0, // 標準: 1.0倍
    'low': 0.7       // 低品質: 0.7倍
};
```

### 2. 動画タイプ別調整

```javascript
const CONTENT_TYPE_ADJUSTMENTS = {
    'static': 0.8,   // 静的コンテンツ（スライド等）
    'normal': 1.0,   // 通常の動画
    'action': 1.3,   // アクション・スポーツ
    'animation': 0.9 // アニメーション
};
```

### 3. 推奨ビットレート計算

```javascript
const targetBitrate = Math.round(
    standardBitrate * 
    QUALITY_MULTIPLIERS[qualityLevel] * 
    CONTENT_TYPE_ADJUSTMENTS[contentType]
);
```

**計算例:**
- 1080p動画（標準2000 Kbps）、低品質、静的コンテンツ
- 2000 × 0.7 × 0.8 = 1120 Kbps

## 推奨設定生成

### 1. 基本推奨設定

```javascript
const recommendations = {
    maintain: {
        description: '現在のビットレートを維持',
        bitrate: Math.round(currentBitrate),
        reason: '現在のビットレートが適切です'
    },
    optimize: {
        description: '最適化されたビットレート',
        bitrate: Math.round(standardBitrate * 1.0 * 1.0),
        reason: '標準的なビットレートに最適化'
    },
    high: {
        description: '高品質設定',
        bitrate: Math.round(standardBitrate * 1.5 * 1.0),
        reason: '高品質を優先した設定'
    },
    low: {
        description: '軽量設定',
        bitrate: Math.round(standardBitrate * 0.7 * 1.0),
        reason: 'ファイルサイズを優先した設定'
    }
};
```

### 2. 特別推奨設定

```javascript
// 現在のビットレートが標準より50%低い場合
if (currentBitrate < standardBitrate * 0.5) {
    recommendations.special = {
        description: '現在の低ビットレートを維持',
        bitrate: Math.round(currentBitrate),
        reason: '元の低ビットレートを保持してファイルサイズを維持'
    };
}
```

## 動的プリセット生成

### 1. ベースプリセット選択

```javascript
let basePreset;
if (isPortrait) {
    if (resolution === '4K' || resolution === '2K') basePreset = 'web_2k';
    else if (resolution === '1080p') basePreset = 'portrait_1080p';
    else basePreset = 'portrait_720p';
} else {
    if (resolution === '4K') basePreset = 'web_4k';
    else if (resolution === '2K') basePreset = 'web_2k';
    else if (resolution === '1080p') basePreset = 'web_1080p';
    else basePreset = 'web_720p';
}
```

### 2. 動的ビットレート設定

```javascript
const maxrate = Math.round(targetBitrate * 1.2); // 最大ビットレート
const bufsize = maxrate * 2; // バッファサイズ
const cq = Math.max(25, Math.min(35, 30 - Math.log2(targetBitrate / 1000)));
```

**設定パラメータ:**
- **maxrate**: 目標ビットレートの120%
- **bufsize**: 最大ビットレートの2倍
- **cq**: 動的CQ値（25-35の範囲）

### 3. 出力オプション生成

```javascript
const dynamicPreset = {
    ...basePresetConfig,
    outputOptions: [
        ...basePresetConfig.outputOptions.filter(opt => 
            !opt.includes('-maxrate') && 
            !opt.includes('-bufsize') && 
            !opt.includes('-cq')
        ),
        `-maxrate ${maxrate}k`,
        `-bufsize ${bufsize}k`,
        `-cq ${cq}`
    ],
    description: `${basePresetConfig.description} (動的設定: ${targetBitrate}kbps)`,
    dynamicSettings: {
        targetBitrate,
        maxrate,
        bufsize,
        originalBitrate: currentBitrate,
        bitrateRatio: bitrateAnalysis.bitrateRatio
    }
};
```

## 使用例とケーススタディ

### ケース1: 低ビットレート動画（366 Kbps）

**入力:**
- 解像度: 1080p
- 現在のビットレート: 366 Kbps
- 標準ビットレート: 2000 Kbps
- ビットレート比率: 0.18

**分析結果:**
- 品質レベル: low
- 動画タイプ: normal
- 特別推奨: あり

**推奨設定:**
- maintain: 366 Kbps（現在のビットレートを維持）
- optimize: 1600 Kbps（標準最適化）
- special: 366 Kbps（低ビットレート維持）

### ケース2: 高品質動画（4000 Kbps）

**入力:**
- 解像度: 1080p
- 現在のビットレート: 4000 Kbps
- 標準ビットレート: 2000 Kbps
- ビットレート比率: 2.0

**分析結果:**
- 品質レベル: high
- 動画タイプ: normal

**推奨設定:**
- maintain: 4000 Kbps
- optimize: 2000 Kbps
- high: 3000 Kbps

## パフォーマンス最適化

### 1. キャッシュ機能

```javascript
if (metadataCache.has(safePath)) {
    const cached = metadataCache.get(safePath);
    if (Date.now() - cached.timestamp < CACHE_CONFIG.METADATA_TTL) {
        return cached.data;
    }
}
```

### 2. 非同期処理

```javascript
const analyzeBitrate = async (videoMetadata) => {
    // 非同期でビットレート分析を実行
    return new Promise((resolve) => {
        // 分析処理
        resolve(analysisResult);
    });
};
```

## エラーハンドリング

### 1. 無効なメタデータ

```javascript
if (!videoMetadata || !videoMetadata.streams) {
    console.error('無効なメタデータ');
    return null;
}
```

### 2. ビットレート計算エラー

```javascript
const currentBitrate = bitrate || (fileSize * 8 / duration / 1000);
if (!Number.isFinite(currentBitrate) || currentBitrate <= 0) {
    console.error('ビットレート計算エラー');
    return null;
}
```

### 3. フォールバック処理

```javascript
if (!bitrateAnalysis) {
    return ORIENTATION_PRESETS.web_1080p; // デフォルトプリセット
}
```

## 拡張性

### 1. 新しい動画タイプの追加

```javascript
const CONTENT_TYPE_ADJUSTMENTS = {
    'static': 0.8,
    'normal': 1.0,
    'action': 1.3,
    'animation': 0.9,
    'new_type': 1.1 // 新しいタイプを追加
};
```

### 2. カスタム品質設定

```javascript
const generateCustomPreset = (bitrateAnalysis, customSettings) => {
    // カスタム設定に基づくプリセット生成
};
```

### 3. 機械学習統合

```javascript
const analyzeWithML = async (videoMetadata) => {
    // 機械学習モデルを使用した高度な分析
};
```

## まとめ

ビットレート分析・算出機能は、動画の特性を深く理解し、最適な変換設定を自動的に決定する高度なシステムです。元のビットレートを基準とした動的な設定により、ファイルサイズの増加を防ぎながら、品質を維持した効率的な変換を実現します。 