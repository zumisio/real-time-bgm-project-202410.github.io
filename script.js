let model;
const video = document.getElementById('camera');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const parts = document.querySelectorAll('.part');
const slider = document.getElementById('myRange');
const knob = document.querySelector('.slider-knob');
const fill = document.querySelector('.slider-fill');
const turtle = document.querySelector('.icon.turtle');
const startButton = document.getElementById('startCamera');
const stopButton = document.getElementById('stopCamera');
const switchButton = document.getElementById('switchCamera');
const detectionLabel = document.getElementById('detectionLabel');

let stream;
let facingMode = 'user';
let isDetecting = false;
let animationFrameId = null;

const partValues = {
    kick: 0,
    snare: 0,
    'hi-hat': 0,
    tom: 0
};

let currentPart = 'kick';

// デジタルドラムサウンドのセットアップ
const kick = new Tone.MembraneSynth().toDestination();
const snare = new Tone.NoiseSynth().toDestination();
const hihat = new Tone.MetalSynth().toDestination();
const tom = new Tone.MembraneSynth().toDestination();
const drums = [kick, snare, hihat, tom];
const drumNames = ['kick', 'snare', 'hi-hat', 'tom'];

function updateSlider(value) {
    slider.value = value;
    knob.style.left = `${value}%`;
    fill.style.width = `${value}%`;
    const sliderTrack = document.querySelector('.slider-track');
    const trackWidth = sliderTrack.offsetWidth;
    const turtlePosition = (value / 100) * (trackWidth - 28);
    turtle.style.left = `${turtlePosition + 10}px`;
}

parts.forEach(part => {
    part.addEventListener('click', function() {
        parts.forEach(p => p.classList.remove('selected'));
        this.classList.add('selected');
        currentPart = this.dataset.part;
        updateSlider(partValues[currentPart]);
    });
});

slider.addEventListener('input', function() {
    const value = this.value;
    partValues[currentPart] = value;
    updateSlider(value);
});

async function loadModel() {
    try {
        model = await cocoSsd.load();
        console.log('Model loaded');
        startButton.disabled = false;
    } catch (error) {
        console.error('Failed to load model:', error);
    }
}
//追加
window.addEventListener('beforeunload', function(event) {
    // Prevents unwanted window navigation or refresh on mobile
    event.preventDefault();
    event.returnValue = '';
});

async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: facingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            isDetecting = true;
            detectObjects();
        };
        startButton.classList.add('hidden');
        stopButton.classList.remove('hidden');
        switchButton.classList.remove('hidden');
    } catch (err) {
        console.error('Failed to start camera:', err);
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        isDetecting = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        detectionLabel.textContent = '';
        startButton.classList.remove('hidden');
        stopButton.classList.add('hidden');
        switchButton.classList.add('hidden');
    }
}

function switchCamera() {
    facingMode = facingMode === 'user' ? 'environment' : 'user';
    stopCamera();
    startCamera();
}

async function detectObjects() {
    if (!isDetecting) return;
    try {
        const predictions = await model.detect(video);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        let detectedObjects = [];
        predictions.forEach(prediction => {
            if (prediction.score > 0.66) {
                detectedObjects.push(prediction.class);
                const [x, y, width, height] = prediction.bbox;
                ctx.strokeStyle = '#FF0000';
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, width, height);
                ctx.fillStyle = '#FF0000';
                ctx.font = '16px Arial';
                ctx.fillText(prediction.class, x, y > 20 ? y - 5 : y + 20);
            }
        });
        if (detectedObjects.length > 0) {
            detectionLabel.textContent = `検出されたオブジェクト: ${detectedObjects.join(', ')}`;
            playRandomDrum(detectedObjects);
        } else {
            detectionLabel.textContent = '検出されたオブジェクトはありません';
        }
    } catch (error) {
        console.error('Object detection error:', error);
    }
    animationFrameId = requestAnimationFrame(detectObjects);
}

function playRandomDrum(detectedObjects) {
    const randomObject = detectedObjects[Math.floor(Math.random() * detectedObjects.length)];
    const randomDrumIndex = Math.floor(Math.random() * drums.length);
    const selectedDrum = drums[randomDrumIndex];
    const selectedDrumName = drumNames[randomDrumIndex];
    console.log(`検出オブジェクト: ${randomObject}, 選択ドラム: ${selectedDrumName}`);
    const randomValue = Math.random() * 100;
    if (randomValue > partValues[selectedDrumName]) {
        switch (selectedDrumName) {
            case 'kick':
                kick.triggerAttackRelease('C2', '8n');
                break;
            case 'snare':
                snare.triggerAttackRelease('8n');
                break;
            case 'hi-hat':
                hihat.triggerAttackRelease('8n');
                break;
            case 'tom':
                tom.triggerAttackRelease('G2', '8n');
                break;
        }
    }
}

startButton.addEventListener('click', startCamera);
stopButton.addEventListener('click', stopCamera);
switchButton.addEventListener('click', switchCamera);

updateSlider(0);

// アプリケーションの初期化
async function initializeApp() {
    try {
        await loadModel();
        await Tone.start();
        console.log('Model loaded and Tone.js initialized');
        startButton.disabled = false;
    } catch (error) {
        console.error('Failed to initialize app:', error);
    }
}

// DOMContentLoadedイベントで初期化を行う
document.addEventListener('DOMContentLoaded', initializeApp);

// アプリケーションの初期化関数
async function initializeApp() {
    try {
        await loadModel();
        await Tone.start();
        console.log('Model loaded and Tone.js initialized');
        startButton.disabled = false;
    } catch (error) {
        console.error('Failed to initialize app:', error);
    }
}

// モデルのロード関数
async function loadModel() {
    try {
        model = await cocoSsd.load();
        console.log('Model loaded');
    } catch (error) {
        console.error('Failed to load model:', error);
        throw error;
    }
}

// カメラ起動関数
async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: facingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            isDetecting = true;
            detectObjects();
        };
        startButton.classList.add('hidden');
        stopButton.classList.remove('hidden');
        switchButton.classList.remove('hidden');
    } catch (err) {
        console.error('Failed to start camera:', err);
    }
}

// カメラ停止関数
function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        isDetecting = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        detectionLabel.textContent = '';
        startButton.classList.remove('hidden');
        stopButton.classList.add('hidden');
        switchButton.classList.add('hidden');
    }
}

// カメラ切り替え関数
function switchCamera() {
    facingMode = facingMode === 'user' ? 'environment' : 'user';
    stopCamera();
    startCamera();
}

// イベントリスナーの設定
startButton.addEventListener('click', startCamera);
stopButton.addEventListener('click', stopCamera);
switchButton.addEventListener('click', switchCamera);

// スライダーの初期化
updateSlider(0);
