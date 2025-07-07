// グローバル変数
let model;
let video;
let canvas;
let ctx;
let isDetecting = false;
let detectionCount = 0;
let lastTime = 0;
let fps = 0;
let animationId;
let stream;

// DOM要素の取得
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusText = document.getElementById('statusText');
const detectionInfo = document.getElementById('detectionInfo');
const detectionCountElement = document.getElementById('detectionCount');
const fpsElement = document.getElementById('fps');

// イベントリスナーの設定
startBtn.addEventListener('click', startDetection);
stopBtn.addEventListener('click', stopDetection);

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function() {
    updateStatus('「カメラを開始」ボタンをクリックしてください');
});

// ステータス更新関数
function updateStatus(message) {
    statusText.textContent = message;
    console.log('Status:', message);
}

// モデルの読み込み
async function loadModel() {
    try {
        updateStatus('AIモデルを読み込み中...');
        model = await cocoSsd.load();
        updateStatus('AIモデルの読み込みが完了しました！');
        console.log('COCO-SSDモデルが正常に読み込まれました');
        return true;
    } catch (error) {
        console.error('モデルの読み込みに失敗しました:', error);
        updateStatus('エラー: AIモデルの読み込みに失敗しました');
        return false;
    }
}

// Webカメラのセットアップ
async function setupWebcam() {
    try {
        updateStatus('Webカメラにアクセス中...');
        
        video = document.getElementById('webcam');
        canvas = document.getElementById('outputCanvas');
        ctx = canvas.getContext('2d');
        
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 640 },
                height: { ideal: 480 }
            } 
        });
        
        video.srcObject = stream;
        
        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                // キャンバスのサイズを動画に合わせる
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                
                updateStatus('Webカメラの準備が完了しました！');
                console.log('Webカメラが正常に起動しました');
                resolve(video);
            };
        });
    } catch (error) {
        console.error('Webカメラのアクセスに失敗しました:', error);
        updateStatus('エラー: Webカメラへのアクセスを許可してください');
        throw error;
    }
}

// 物体検出の開始
async function startDetection() {
    try {
        startBtn.disabled = true;
        updateStatus('初期化中...');
        
        // モデルの読み込み
        if (!model) {
            const modelLoaded = await loadModel();
            if (!modelLoaded) {
                startBtn.disabled = false;
                return;
            }
        }
        
        // Webカメラのセットアップ
        if (!video || !video.srcObject) {
            await setupWebcam();
        }
        
        // 検出開始
        isDetecting = true;
        stopBtn.disabled = false;
        updateStatus('物体検出を実行中...');
        
        // 統計情報のリセット
        detectionCount = 0;
        lastTime = performance.now();
        
        // 検出ループの開始
        detectFrame();
        
    } catch (error) {
        console.error('検出の開始に失敗しました:', error);
        updateStatus('エラー: 物体検出の開始に失敗しました');
        startBtn.disabled = false;
        stopBtn.disabled = true;
    }
}

// 物体検出の停止
function stopDetection() {
    isDetecting = false;
    stopBtn.disabled = true;
    startBtn.disabled = false;
    
    // アニメーションフレームのキャンセル
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    
    // カメラストリームの停止
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    // ビデオ要素のクリア
    if (video) {
        video.srcObject = null;
    }
    
    // キャンバスのクリア
    if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    updateStatus('物体検出を停止しました');
    updateDetectionInfo([]);
}

// フレームごとの物体検出
async function detectFrame() {
    if (!isDetecting || !model || !video.srcObject) {
        return;
    }
    
    try {
        // 物体検出の実行
        const predictions = await model.detect(video);
        
        // 結果の描画
        drawPredictions(predictions);
        
        // 検出情報の更新
        updateDetectionInfo(predictions);
        
        // 統計情報の更新
        updateStats(predictions);
        
    } catch (error) {
        console.error('検出処理でエラーが発生しました:', error);
    }
    
    // 次のフレームの予約
    if (isDetecting) {
        animationId = requestAnimationFrame(detectFrame);
    }
}

// 検出結果の描画
function drawPredictions(predictions) {
    // キャンバスのクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 検出結果の描画
    predictions.forEach(prediction => {
        const [x, y, width, height] = prediction.bbox;
        const className = prediction.class;
        const score = Math.round(prediction.score * 100);
        
        // 信頼度が50%以上の場合のみ描画
        if (score >= 50) {
            // バウンディングボックスの描画
            ctx.strokeStyle = '#00FFFF';
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, width, height);
            
            // ラベルの背景
            const labelText = `${className} (${score}%)`;
            ctx.font = '16px Arial';
            const textWidth = ctx.measureText(labelText).width;
            const textHeight = 20;
            
            // ラベルの背景を描画
            ctx.fillStyle = '#00FFFF';
            ctx.fillRect(x, y > textHeight ? y - textHeight : y, textWidth + 10, textHeight);
            
            // ラベルのテキストを描画
            ctx.fillStyle = '#000000';
            ctx.fillText(labelText, x + 5, y > textHeight ? y - 5 : y + 15);
        }
    });
}

// 検出情報の更新
function updateDetectionInfo(predictions) {
    if (predictions.length === 0) {
        detectionInfo.innerHTML = '<p>物体が検出されませんでした</p>';
        return;
    }
    
    // 信頼度が50%以上の予測結果のみフィルタリング
    const filteredPredictions = predictions.filter(pred => pred.score >= 0.5);
    
    if (filteredPredictions.length === 0) {
        detectionInfo.innerHTML = '<p>十分な信頼度の物体が検出されませんでした</p>';
        return;
    }
    
    // 検出結果をソート（信頼度の高い順）
    filteredPredictions.sort((a, b) => b.score - a.score);
    
    let html = '<div>';
    filteredPredictions.forEach((prediction, index) => {
        const className = prediction.class;
        const score = Math.round(prediction.score * 100);
        const [x, y, width, height] = prediction.bbox;
        
        html += `
            <div class="detection-item">
                <strong>${className}</strong>
                <span class="confidence">(信頼度: ${score}%)</span>
                <div style="font-size: 0.8rem; color: #666;">
                    位置: (${Math.round(x)}, ${Math.round(y)}) 
                    サイズ: ${Math.round(width)}×${Math.round(height)}
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    detectionInfo.innerHTML = html;
}

// 統計情報の更新
function updateStats(predictions) {
    // 検出数の更新
    const validPredictions = predictions.filter(pred => pred.score >= 0.5);
    detectionCount = validPredictions.length;
    detectionCountElement.textContent = detectionCount;
    
    // FPS の計算
    const currentTime = performance.now();
    const deltaTime = currentTime - lastTime;
    if (deltaTime > 0) {
        fps = Math.round(1000 / deltaTime);
        fpsElement.textContent = fps;
    }
    lastTime = currentTime;
}

// エラーハンドリング
window.addEventListener('error', function(event) {
    console.error('予期しないエラーが発生しました:', event.error);
    updateStatus('エラーが発生しました。ページを再読み込みしてください。');
});

// ページを離れる際のクリーンアップ
window.addEventListener('beforeunload', function() {
    if (isDetecting) {
        stopDetection();
    }
});

// デバッグ用のログ
console.log('物体検出スクリプトが読み込まれました');
console.log('TensorFlow.js version:', tf.version.tfjs);

// 利用可能なデバイスの確認
navigator.mediaDevices.enumerateDevices()
    .then(devices => {
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        console.log('利用可能なビデオデバイス:', videoDevices.length);
    })
    .catch(err => {
        console.error('デバイスの確認に失敗しました:', err);
    });

// COCO-SSDで検出可能な物体クラス一覧（参考）
const COCO_CLASSES = [
    'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck',
    'boat', 'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench',
    'bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra',
    'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
    'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove',
    'skateboard', 'surfboard', 'tennis racket', 'bottle', 'wine glass', 'cup',
    'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange',
    'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
    'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
    'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
    'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier',
    'toothbrush'
];

console.log('COCO-SSDで検出可能な物体クラス数:', COCO_CLASSES.length);