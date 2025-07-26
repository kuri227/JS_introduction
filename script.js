//================================================
// グローバル変数・設定値
//================================================
let model;                      // COCO-SSDモデルを格納する変数
let video;                      // video要素を格納する変数
let canvas;                     // canvas要素を格納する変数
let ctx;                        // canvasの2Dコンテキスト
let isDetecting = false;        // 検出中フラグ
let animationId;                // requestAnimationFrameのID
let stream;                     // カメラのメディアストリーム

// === カスタマイズ可能な設定値 ===
const SCORE_THRESHOLD = 0.5;    // 物体として認識する信頼度の閾値 (0.0 ~ 1.0)
const BOX_COLOR = '#0ea5e9';    // バウンディングボックスの色
const BOX_LINE_WIDTH = 3;       // バウンディングボックスの線の太さ
const LABEL_FONT_SIZE = 16;     // ラベルのフォントサイズ
const LABEL_FONT_FAMILY = 'Inter, "Noto Sans JP", sans-serif'; // ラベルのフォント

// 検出統計用の変数
let detectionCount = 0;
let lastTime = 0;
let fps = 0;
let frameCount = 0;

//================================================
// DOM要素の取得
//================================================
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusText = document.getElementById('statusText');
const detectionInfo = document.getElementById('detectionInfo');
const detectionCountElement = document.getElementById('detectionCount');
const fpsElement = document.getElementById('fps');

//================================================
// イベントリスナーの設定
//================================================
/**
 * ページが完全に読み込まれてからスクリプトを初期化
 */
document.addEventListener('DOMContentLoaded', initializePage);

/**
 * ページ読み込み時の初期化処理
 * フォントの読み込み完了を待ってから初期化を実行
 */
async function initializePage() {
    try {
        // フォントの読み込み完了を待つ
        await loadFonts();
        
        // イベントリスナーを設定
        startBtn.addEventListener('click', startDetection);
        stopBtn.addEventListener('click', stopDetection);
        
        // 初期状態の設定
        updateStatus('「カメラを開始」ボタンをクリックしてください', 'info');
        
        console.log('✅ ページが正常に初期化されました');
        console.log('📚 使用フォント: Inter, Noto Sans JP, JetBrains Mono, Space Grotesk');
        
    } catch (error) {
        console.error('❌ ページの初期化中にエラーが発生:', error);
        updateStatus('初期化エラーが発生しました', 'error');
    }
}

/**
 * Web Fonts APIを使用してフォントの読み込み完了を待つ
 * @returns {Promise<void>}
 */
async function loadFonts() {
    if ('fonts' in document) {
        try {
            // 重要なフォントが読み込まれるまで待機
            await Promise.all([
                document.fonts.load('400 16px Inter'),
                document.fonts.load('600 16px Inter'),
                document.fonts.load('400 16px "Noto Sans JP"'),
                document.fonts.load('400 16px "JetBrains Mono"'),
                document.fonts.load('600 16px "Space Grotesk"')
            ]);
            
            console.log('🎨 フォントの読み込みが完了しました');
        } catch (error) {
            console.warn('⚠️ 一部フォントの読み込みに失敗しましたが、処理を続行します:', error);
        }
    }
}

/**
 * ステータス表示を更新するヘルパー関数（スタイリッシュな表示対応）
 * @param {string} message 表示するメッセージ
 * @param {string} type メッセージタイプ ('info', 'success', 'warning', 'error')
 */
function updateStatus(message, type = 'info') {
    if (!statusText) return;
    
    statusText.textContent = message;
    
    // タイプに応じてスタイリングを変更
    statusText.className = 'status-text';
    switch (type) {
        case 'success':
            statusText.style.color = '#059669';
            statusText.style.fontWeight = '600';
            break;
        case 'warning':
            statusText.style.color = '#d97706';
            statusText.style.fontWeight = '500';
            break;
        case 'error':
            statusText.style.color = '#dc2626';
            statusText.style.fontWeight = '600';
            break;
        default:
            statusText.style.color = '#475569';
            statusText.style.fontWeight = '500';
    }
    
    console.log(`[${type.toUpperCase()}] ${message}`);
}

/**
 * COCO-SSDモデルを非同期で読み込む
 * @returns {Promise<boolean>} モデルの読み込みに成功したか
 */
async function loadModel() {
    try {
        updateStatus('🤖 AIモデルを読み込み中...', 'info');
        
        const startTime = performance.now();
        model = await cocoSsd.load();
        const loadTime = Math.round(performance.now() - startTime);
        
        updateStatus(`✨ AIモデルの読み込みが完了しました！(${loadTime}ms)`, 'success');
        console.log('🎯 COCO-SSDモデルが正常に読み込まれました');
        
        return true;
    } catch (error) {
        console.error('❌ モデルの読み込みに失敗しました:', error);
        updateStatus('❌ AIモデルの読み込みに失敗しました', 'error');
        return false;
    }
}

/**
 * Webカメラをセットアップする
 * @returns {Promise<HTMLVideoElement>} セットアップ完了後のvideo要素
 */
async function setupWebcam() {
    try {
        updateStatus('📹 Webカメラにアクセス中...', 'info');
        
        video = document.getElementById('webcam');
        canvas = document.getElementById('outputCanvas');
        ctx = canvas.getContext('2d');
        
        // カメラの制約を設定
        const constraints = {
            video: { 
                width: { ideal: 640, max: 1280 },
                height: { ideal: 480, max: 720 },
                facingMode: 'user' // フロントカメラを優先
            },
            audio: false
        };
        
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        
        return new Promise((resolve, reject) => {
            video.onloadedmetadata = () => {
                // Canvasのサイズをビデオに合わせる
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                
                // Canvasのフォント設定を初期化
                ctx.font = `${LABEL_FONT_SIZE}px ${LABEL_FONT_FAMILY}`;
                ctx.textBaseline = 'top';
                
                updateStatus('🎥 Webカメラの準備が完了しました！', 'success');
                console.log(`📐 映像サイズ: ${video.videoWidth}x${video.videoHeight}`);
                
                resolve(video);
            };
            
            video.onerror = (error) => {
                console.error('❌ ビデオの読み込みエラー:', error);
                reject(error);
            };
            
            // タイムアウト設定（10秒）
            setTimeout(() => {
                reject(new Error('ビデオの読み込みがタイムアウトしました'));
            }, 10000);
        });
        
    } catch (error) {
        console.error('❌ Webカメラのアクセスに失敗しました:', error);
        
        let errorMessage = '❌ Webカメラへのアクセスに失敗しました';
        if (error.name === 'NotAllowedError') {
            errorMessage = '🚫 カメラへのアクセスが拒否されました。ブラウザの設定を確認してください';
        } else if (error.name === 'NotFoundError') {
            errorMessage = '📹 カメラが見つかりません。デバイスを確認してください';
        }
        
        updateStatus(errorMessage, 'error');
        throw error;
    }
}

/**
 * 物体検出を開始するメインの関数
 */
async function startDetection() {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    
    try {
        // モデルが未読み込みの場合は読み込む
        if (!model) {
            const modelLoaded = await loadModel();
            if (!modelLoaded) {
                throw new Error('モデルの読み込みに失敗しました');
            }
        }
        
        // カメラが未起動またはストリームが無効な場合はセットアップ
        if (!stream || !stream.active) {
            await setupWebcam();
        }
        
        // 検出フラグを設定し、統計をリセット
        isDetecting = true;
        frameCount = 0;
        lastTime = performance.now();
        
        updateStatus('🔍 物体検出を実行中...', 'success');
        console.log('🚀 物体検出を開始しました');
        
        // 検出ループを開始
        detectFrame();
        
    } catch (error) {
        console.error('❌ 検出の開始に失敗しました:', error);
        updateStatus('💥 検出の開始に失敗しました', 'error');
        stopDetection(); // 失敗時には状態をリセット
    }
}

/**
 * 物体検出を停止し、リソースを解放する
 */
function stopDetection() {
    isDetecting = false;
    
    // アニメーションフレームをキャンセル
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    
    // カメラストリームを停止
    if (stream) {
        stream.getTracks().forEach(track => {
            track.stop();
            console.log(`🔌 ${track.kind}トラックを停止しました`);
        });
        stream = null;
    }
    
    // Canvasをクリア
    if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    // UIの状態をリセット
    startBtn.disabled = false;
    stopBtn.disabled = true;
    
    updateStatus('⏹️ 物体検出を停止しました。「カメラを開始」ボタンで再開できます。', 'info');
    updateDetectionInfo([]);
    resetStats();
    
    console.log('🛑 物体検出を停止しました');
}

/**
 * 統計情報をリセットする
 */
function resetStats() {
    detectionCount = 0;
    fps = 0;
    frameCount = 0;
    
    if (detectionCountElement) detectionCountElement.textContent = '0';
    if (fpsElement) fpsElement.textContent = '0';
}

/**
 * 1フレームごとの物体検出と描画を行うループ関数
 * requestAnimationFrameを使用してスムーズな処理を実現
 */
async function detectFrame() {
    if (!isDetecting || !model || !video) return;
    
    try {
        // 物体検出を実行
        const startTime = performance.now();
        const predictions = await model.detect(video);
        const detectionTime = performance.now() - startTime;
        
        // 結果を描画
        drawPredictions(predictions);
        
        // UI情報を更新
        updateDetectionInfo(predictions);
        updateStats(predictions, detectionTime);
        
        // 次のフレームをスケジュール
        animationId = requestAnimationFrame(detectFrame);
        
    } catch (error) {
        console.error('❌ 検出ループでエラーが発生:', error);
        updateStatus('💥 検出中にエラーが発生しました', 'error');
        stopDetection();
    }
}

/**
 * 検出結果をCanvasに高品質で描画する
 * @param {Array} predictions 検出結果の配列
 */
function drawPredictions(predictions) {
    if (!ctx || !canvas) return;
    
    // Canvasをクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 高品質レンダリング設定
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // 閾値以上の予測のみを処理
    const filteredPredictions = predictions.filter(prediction => 
        prediction.score >= SCORE_THRESHOLD
    );
    
    filteredPredictions.forEach((prediction, index) => {
        const [x, y, width, height] = prediction.bbox;
        const className = prediction.class;
        const score = Math.round(prediction.score * 100);
        
        // バウンディングボックスを描画
        drawBoundingBox(x, y, width, height, index);
        
        // ラベルを描画
        drawLabel(x, y, className, score, index);
    });
}

/**
 * スタイリッシュなバウンディングボックスを描画
 * @param {number} x X座標
 * @param {number} y Y座標  
 * @param {number} width 幅
 * @param {number} height 高さ
 * @param {number} index インデックス（色の変化用）
 */
function drawBoundingBox(x, y, width, height, index) {
    // グラデーション効果のある色を生成
    const colors = ['#0ea5e9', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b'];
    const color = colors[index % colors.length];
    
    // メインの枠線
    ctx.strokeStyle = color;
    ctx.lineWidth = BOX_LINE_WIDTH;
    ctx.setLineDash([]);
    ctx.strokeRect(x, y, width, height);
    
    // 角のアクセント
    const cornerSize = 20;
    ctx.lineWidth = BOX_LINE_WIDTH + 1;
    ctx.strokeStyle = color;
    
    // 左上の角
    ctx.beginPath();
    ctx.moveTo(x, y + cornerSize);
    ctx.lineTo(x, y);
    ctx.lineTo(x + cornerSize, y);
    ctx.stroke();
    
    // 右上の角
    ctx.beginPath();
    ctx.moveTo(x + width - cornerSize, y);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x + width, y + cornerSize);
    ctx.stroke();
    
    // 左下の角
    ctx.beginPath();
    ctx.moveTo(x, y + height - cornerSize);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x + cornerSize, y + height);
    ctx.stroke();
    
    // 右下の角
    ctx.beginPath();
    ctx.moveTo(x + width - cornerSize, y + height);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x + width, y + height - cornerSize);
    ctx.stroke();
}

/**
 * 美しいラベルを描画
 * @param {number} x X座標
 * @param {number} y Y座標
 * @param {string} className クラス名
 * @param {number} score 信頼度スコア
 * @param {number} index インデックス（色の変化用）
 */
function drawLabel(x, y, className, score, index) {
    const colors = ['#0ea5e9', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b'];
    const color = colors[index % colors.length];
    
    const labelText = `${className} ${score}%`;
    
    // フォント設定
    ctx.font = `600 ${LABEL_FONT_SIZE}px ${LABEL_FONT_FAMILY}`;
    ctx.textBaseline = 'top';
    
    // テキストサイズを測定
    const textMetrics = ctx.measureText(labelText);
    const textWidth = textMetrics.width;
    const textHeight = LABEL_FONT_SIZE;
    
    // ラベル背景のパディング
    const padding = 8;
    const labelWidth = textWidth + (padding * 2);
    const labelHeight = textHeight + (padding * 2);
    
    // ラベル位置を調整（画面外に出ないように）
    let labelX = x;
    let labelY = y - labelHeight - 5;
    
    if (labelY < 0) {
        labelY = y + 5; // 上に出る場合は下に表示
    }
    if (labelX + labelWidth > canvas.width) {
        labelX = canvas.width - labelWidth; // 右に出る場合は左に調整
    }
    
    // グラデーション背景を作成
    const gradient = ctx.createLinearGradient(labelX, labelY, labelX, labelY + labelHeight);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, adjustBrightness(color, -20));
    
    // 背景を描画（角丸）
    ctx.fillStyle = gradient;
    drawRoundedRect(ctx, labelX, labelY, labelWidth, labelHeight, 6);
    ctx.fill();
    
    // 影効果
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;
    
    // テキストを描画
    ctx.fillStyle = '#ffffff';
    ctx.fillText(labelText, labelX + padding, labelY + padding);
    
    // 影をリセット
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
}

/**
 * 角丸矩形を描画するヘルパー関数
 * @param {CanvasRenderingContext2D} ctx Canvas context
 * @param {number} x X座標
 * @param {number} y Y座標
 * @param {number} width 幅
 * @param {number} height 高さ
 * @param {number} radius 角の半径
 */
function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

/**
 * 色の明度を調整するヘルパー関数
 * @param {string} color HEX色コード
 * @param {number} amount 調整量（-100〜100）
 * @returns {string} 調整された色
 */
function adjustBrightness(color, amount) {
    const num = parseInt(color.replace("#", ""), 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amount));
    const g = Math.max(0, Math.min(255, (num >> 8 & 0x00FF) + amount));
    const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * 検出情報パネルのHTMLを美しく更新する
 * @param {Array} predictions 検出結果の配列
 */
function updateDetectionInfo(predictions) {
    if (!detectionInfo) return;
    
    const filteredPredictions = predictions.filter(p => p.score >= SCORE_THRESHOLD);

    if (filteredPredictions.length === 0) {
        detectionInfo.innerHTML = `
            <div style="text-align: center; color: #64748b; font-style: italic; padding: 2rem;">
                <span style="font-size: 2rem; display: block; margin-bottom: 0.5rem;">🔍</span>
                物体が検出されませんでした
            </div>
        `;
        return;
    }
    
    // 信頼度順でソート
    filteredPredictions.sort((a, b) => b.score - a.score);
    
    let html = '<div class="detection-results">';
    
    filteredPredictions.forEach((prediction, index) => {
        const colors = ['#0ea5e9', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b'];
        const color = colors[index % colors.length];
        const confidence = Math.round(prediction.score * 100);
        
        // 日本語への翻訳を試みる
        const translatedClass = translateClass(prediction.class);
        
        html += `
            <div class="detection-item" style="border-left: 4px solid ${color};">
                <div class="detection-main">
                    <strong style="color: #1e293b; font-family: 'Inter', 'Noto Sans JP', sans-serif;">
                        ${translatedClass}
                    </strong>
                    <span class="confidence" style="color: ${color}; font-family: 'JetBrains Mono', monospace;">
                        ${confidence}%
                    </span>
                </div>
                <div class="detection-meta" style="font-size: 0.85rem; color: #64748b; margin-top: 0.25rem; font-family: 'Inter', sans-serif;">
                    位置: ${Math.round(prediction.bbox[0])}, ${Math.round(prediction.bbox[1])} | 
                    サイズ: ${Math.round(prediction.bbox[2])}×${Math.round(prediction.bbox[3])}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    detectionInfo.innerHTML = html;
}

/**
 * クラス名を日本語に翻訳する
 * @param {string} className 英語のクラス名
 * @returns {string} 日本語のクラス名
 */
function translateClass(className) {
    const translations = {
        'person': '人',
        'bicycle': '自転車',
        'car': '車',
        'motorcycle': 'バイク',
        'airplane': '飛行機',
        'bus': 'バス',
        'train': '電車',
        'truck': 'トラック',
        'boat': 'ボート',
        'traffic light': '信号機',
        'fire hydrant': '消火栓',
        'stop sign': '停止標識',
        'parking meter': 'パーキングメーター',
        'bench': 'ベンチ',
        'bird': '鳥',
        'cat': '猫',
        'dog': '犬',
        'horse': '馬',
        'sheep': '羊',
        'cow': '牛',
        'elephant': '象',
        'bear': '熊',
        'zebra': 'シマウマ',
        'giraffe': 'キリン',
        'backpack': 'リュックサック',
        'umbrella': '傘',
        'handbag': 'ハンドバッグ',
        'tie': 'ネクタイ',
        'suitcase': 'スーツケース',
        'frisbee': 'フリスビー',
        'skis': 'スキー',
        'snowboard': 'スノーボード',
        'sports ball': 'ボール',
        'kite': '凧',
        'baseball bat': 'バット',
        'baseball glove': 'グローブ',
        'skateboard': 'スケートボード',
        'surfboard': 'サーフボード',
        'tennis racket': 'テニスラケット',
        'bottle': 'ボトル',
        'wine glass': 'ワイングラス',
        'cup': 'カップ',
        'fork': 'フォーク',
        'knife': 'ナイフ',
        'spoon': 'スプーン',
        'bowl': 'ボウル',
        'banana': 'バナナ',
        'apple': 'りんご',
        'sandwich': 'サンドイッチ',
        'orange': 'オレンジ',
        'broccoli': 'ブロッコリー',
        'carrot': 'にんじん',
        'hot dog': 'ホットドッグ',
        'pizza': 'ピザ',
        'donut': 'ドーナツ',
        'cake': 'ケーキ',
        'chair': '椅子',
        'couch': 'ソファ',
        'potted plant': '植木鉢',
        'bed': 'ベッド',
        'dining table': 'テーブル',
        'toilet': 'トイレ',
        'tv': 'テレビ',
        'laptop': 'ノートPC',
        'mouse': 'マウス',
        'remote': 'リモコン',
        'keyboard': 'キーボード',
        'cell phone': 'スマホ',
        'microwave': '電子レンジ',
        'oven': 'オーブン',
        'toaster': 'トースター',
        'sink': 'シンク',
        'refrigerator': '冷蔵庫',
        'book': '本',
        'clock': '時計',
        'vase': '花瓶',
        'scissors': 'はさみ',
        'teddy bear': 'テディベア',
        'hair drier': 'ドライヤー',
        'toothbrush': '歯ブラシ'
    };
    
    return translations[className] || className;
}

/**
 * 統計情報（検出数、FPS）を更新する
 * @param {Array} predictions 検出結果の配列
 * @param {number} detectionTime 検出にかかった時間（ms）
 */
function updateStats(predictions, detectionTime) {
    frameCount++;
    
    // 検出数を更新
    detectionCount = predictions.filter(p => p.score >= SCORE_THRESHOLD).length;
    if (detectionCountElement) {
        detectionCountElement.textContent = detectionCount;
    }
    
    // FPSを計算（1秒間隔で更新）
    const currentTime = performance.now();
    const deltaTime = currentTime - lastTime;
    
    if (deltaTime >= 1000) { // 1秒経過
        fps = Math.round((frameCount * 1000) / deltaTime);
        
        if (fpsElement) {
            fpsElement.textContent = fps;
            
            // FPSに応じて色を変更
            if (fps >= 25) {
                fpsElement.style.color = '#059669'; // 緑
            } else if (fps >= 15) {
                fpsElement.style.color = '#d97706'; // オレンジ
            } else {
                fpsElement.style.color = '#dc2626'; // 赤
            }
        }
        
        lastTime = currentTime;
        frameCount = 0;
        
        // パフォーマンス情報をコンソールに出力（デバッグ用）
        if (detectionTime > 0) {
            console.log(`📊 FPS: ${fps}, 検出時間: ${Math.round(detectionTime)}ms, 検出数: ${detectionCount}`);
        }
    }
}

/**
 * ページを離れる際のクリーンアップ処理
 */
function cleanup() {
    console.log('🧹 リソースをクリーンアップ中...');
    stopDetection();
}

// イベントリスナーを登録
window.addEventListener('beforeunload', cleanup);
window.addEventListener('unload', cleanup);

// ページの可視性が変わった時の処理（ブラウザタブの切り替えなど）
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isDetecting) {
        console.log('👁️ ページが非表示になったため検出を一時停止');
        // 必要に応じて検出を一時停止する処理をここに追加
    } else if (!document.hidden && !isDetecting && stream && stream.active) {
        console.log('👁️ ページが表示されました');
        // 必要に応じて検出を再開する処理をここに追加
    }
});

// エラーハンドリング強化
window.addEventListener('error', (event) => {
    console.error('💥 グローバルエラーが発生:', event.error);
    if (isDetecting) {
        updateStatus('💥 予期しないエラーが発生しました', 'error');
        stopDetection();
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('💥 未処理のPromise拒否:', event.reason);
    if (isDetecting) {
        updateStatus('💥 非同期処理でエラーが発生しました', 'error');
        stopDetection();
    }
});

console.log('🎨 スタイリッシュな物体検出システムが読み込まれました');
console.log('🔤 フォント: Inter, Noto Sans JP, JetBrains Mono, Space Grotesk');
console.log('🎯 機能: リアルタイム物体検出、美しいUI、日本語対応');