let model;
const video = document.getElementById('webcam');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const liveView = document.getElementById('liveView');
const enableWebcamButton = document.getElementById('webcamButton');
const stopWebcamButton = document.getElementById('stopWebcamButton');
const switchCameraButton = document.getElementById('switchCameraButton');
const refreshButton = document.getElementById('refreshButton');
const detectionConsole = document.getElementById('detectionConsole');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');
const resultMatrix = document.getElementById('resultMatrix');

let stream = null;
let currentFacingMode = 'user';
let isDetecting = false;
let animationFrameId = null;

// Digital drum sound setup
const kick = new Tone.MembraneSynth({
    pitchDecay: 0.01,
    octaves: 6,
    oscillator: { type: 'square' },
    envelope: {
        attack: 0.001,
        decay: 0.2,
        sustain: 0,
        release: 0.2
    }
}).toDestination();

const snare = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: {
        attack: 0.001,
        decay: 0.1,
        sustain: 0,
        release: 0.1
    }
}).toDestination();

const hihat = new Tone.MetalSynth({
    frequency: 200,
    envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5
}).toDestination();

const tom = new Tone.MembraneSynth({
    pitchDecay: 0.02,
    octaves: 4,
    oscillator: { type: 'triangle' },
    envelope: {
        attack: 0.001,
        decay: 0.1,
        sustain: 0,
        release: 0.1
    }
}).toDestination();

const drums = [kick, snare, hihat, tom];
const drumControls = ['kickControl', 'snareControl', 'hihatControl', 'tomControl'];
let currentDrumIndex = 0;
let lastDetectedObject = null;

// Drum parameter knobs and randomness knobs
const knobs = {
    kick: { main: document.getElementById('kickKnob'), randomness: document.getElementById('kickRandomnessKnob') },
    snare: { main: document.getElementById('snareKnob'), randomness: document.getElementById('snareRandomnessKnob') },
    hihat: { main: document.getElementById('hihatKnob'), randomness: document.getElementById('hihatRandomnessKnob') },
    tom: { main: document.getElementById('tomKnob'), randomness: document.getElementById('tomRandomnessKnob') }
};

// Randomness values
let randomnessValues = {
    kick: 0,
    snare: 0,
    hihat: 0,
    tom: 0
};

function setupKnob(knob, minValue, maxValue, initialValue, updateFunction) {
    let isDragging = false;
    let startY;
    let startValue = initialValue;

    function startDragging(e) {
        isDragging = true;
        startY = e.clientY || e.touches[0].clientY;
        startValue = parseFloat(knob.getAttribute('data-value') || initialValue);
        e.preventDefault();
    }

    function drag(e) {
        if (!isDragging) return;
        const currentY = e.clientY || e.touches[0].clientY;
        const diff = startY - currentY;
        const newValue = Math.max(minValue, Math.min(maxValue, startValue + diff * (maxValue - minValue) / 100));
        updateFunction(newValue);
        knob.style.transform = `rotate(${(newValue - minValue) / (maxValue - minValue) * 270 - 135}deg)`;
        knob.setAttribute('data-value', newValue);
    }

    function stopDragging() {
        isDragging = false;
    }

    knob.addEventListener('mousedown', startDragging);
    knob.addEventListener('touchstart', startDragging);
    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', drag);
    document.addEventListener('mouseup', stopDragging);
    document.addEventListener('touchend', stopDragging);

    // Set initial position
    knob.style.transform = `rotate(${(initialValue - minValue) / (maxValue - minValue) * 270 - 135}deg)`;
    knob.setAttribute('data-value', initialValue);
    updateFunction(initialValue);
}

// Set up knobs
setupKnob(knobs.kick.main, 20, 150, 40, (value) => { kick.pitch = value; });
setupKnob(knobs.snare.main, 100, 500, 200, (value) => { snare.noise.type = value < 300 ? 'pink' : 'white'; });
setupKnob(knobs.hihat.main, 2000, 10000, 6000, (value) => { hihat.frequency.value = value; });
setupKnob(knobs.tom.main, 50, 200, 100, (value) => { tom.pitch = value; });

// Set up randomness knobs
setupKnob(knobs.kick.randomness, 0, 100, 0, (value) => { randomnessValues.kick = value; });
setupKnob(knobs.snare.randomness, 0, 100, 0, (value) => { randomnessValues.snare = value; });
setupKnob(knobs.hihat.randomness, 0, 100, 0, (value) => { randomnessValues.hihat = value; });
setupKnob(knobs.tom.randomness, 0, 100, 0, (value) => { randomnessValues.tom = value; });

volumeSlider.addEventListener('input', function() {
    const volume = parseInt(this.value);
    volumeValue.textContent = `${volume} dB`;
    Tone.Destination.volume.value = volume;
});

// Load the model
cocoSsd.load().then(function (loadedModel) {
    model = loadedModel;
    enableWebcamButton.disabled = false;
}).catch(function(error) {
    console.error("Failed to load model:", error);
});

function hasGetUserMedia() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

if (hasGetUserMedia()) {
    enableWebcamButton.addEventListener('click', enableCam);
    stopWebcamButton.addEventListener('click', stopCam);
    switchCameraButton.addEventListener('click', switchCamera);
    refreshButton.addEventListener('click', refreshApp);
} else {
    console.warn('getUserMedia() is not supported by your browser');
    enableWebcamButton.disabled = true;
}

function enableCam(event) {
    if (!model) {
        console.log('Model not loaded yet, please wait.');
        return;
    }
    enableWebcamButton.classList.add('hidden');
    stopWebcamButton.classList.remove('hidden');
    switchCameraButton.classList.remove('hidden');
    refreshButton.classList.remove('hidden');
    startCamera();
}

function startCamera() {
    if (stream) {
        stopCameraStream();
    }
    const constraints = {
        video: { facingMode: currentFacingMode }
    };
    navigator.mediaDevices.getUserMedia(constraints)
        .then(function(s) {
            stream = s;
            video.srcObject = stream;
            video.onloadedmetadata = function() {
                video.play();
                updateCanvasSize();
                predictWebcam();
            };
            Tone.start();
        })
        .catch(function(error) {
            console.error("Error starting the camera: ", error);
        });
}

function stopCameraStream() {
    if (stream) {
        stream.getTracks().forEach(track => {
            track.stop();
        });
    }
    video.srcObject = null;
    stream = null;
}

function stopCam() {
    stopCameraStream();
    isDetecting = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    detectionConsole.innerHTML = '';
    resultMatrix.innerHTML = '';
    stopWebcamButton.classList.add('hidden');
    enableWebcamButton.classList.remove('hidden');
    switchCameraButton.classList.add('hidden');
    refreshButton.classList.add('hidden');
    updateDrumIndicator(-1);
}

function switchCamera() {
    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    startCamera();
}

function refreshApp() {
    stopCameraStream();
    startCamera();
}

function playDrum(detectedObject) {
    if (detectedObject !== lastDetectedObject) {
        currentDrumIndex = (currentDrumIndex + 1) % 4;
        lastDetectedObject = detectedObject;
    }
    updateDrumIndicator(currentDrumIndex);
    
    const randomValue = Math.random() * 100;
    let shouldPlay = false;

    switch(currentDrumIndex) {
        case 0:
            shouldPlay = randomValue > randomnessValues.kick;
            if (shouldPlay) kick.triggerAttackRelease(kick.pitch, "16n");
            break;
        case 1:
            shouldPlay = randomValue > randomnessValues.snare;
            if (shouldPlay) snare.triggerAttackRelease("16n");
            break;
        case 2:
            shouldPlay = randomValue > randomnessValues.hihat;
            if (shouldPlay) hihat.triggerAttackRelease("16n");
            break;
        case 3:
            shouldPlay = randomValue > randomnessValues.tom;
            if (shouldPlay) tom.triggerAttackRelease(tom.pitch, "16n");
            break;
    }
}

function updateDrumIndicator(activeIndex) {
    drumControls.forEach((controlId, index) => {
        const control = document.getElementById(controlId);
        if (index === activeIndex) {
            control.classList.add('active');
        } else {
            control.classList.remove('active');
        }
    });
}

function updateCanvasSize() {
    const containerWidth = liveView.offsetWidth;
    const containerHeight = liveView.offsetHeight;
    const size = Math.min(containerWidth, containerHeight);
    canvas.width = size;
    canvas.height = size;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    canvas.style.left = `${(containerWidth - size) / 2}px`;
    canvas.style.top = `${(containerHeight - size) / 2}px`;
}

function predictWebcam() {
    if (!stream) return;
    model.detect(video).then(function (predictions) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let detectedObjects = [];
        const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
        const offsetX = (canvas.width - video.videoWidth * scale) / 2;
        const offsetY = (canvas.height - video.videoHeight * scale) / 2;
        ctx.strokeStyle = '#FF5733';
        ctx.lineWidth = 4;
        ctx.fillStyle = '#FF5733';
        ctx.font = '18px Inter';
        for (let n = 0; n < predictions.length; n++) {
            if (predictions[n].score > 0.66) {
                const [x, y, width, height] = predictions[n].bbox;
                const scaledX = x * scale + offsetX;
                const scaledY = y * scale + offsetY;
                const scaledWidth = width * scale;
                const scaledHeight = height * scale;
                ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);
                ctx.fillText(`${predictions[n].class} - ${Math.round(predictions[n].score * 100)}%`, scaledX, scaledY > 10 ? scaledY - 5 : 10);
                updateResultMatrix(predictions[n].class, predictions[n].score);
                addToConsole(predictions[n].class, predictions[n].score);
                detectedObjects.push(predictions[n].class);
            }
        }
        if (detectedObjects.length > 0) {
            playDrum(detectedObjects[0]);
        } else {
            updateDrumIndicator(-1);
        }
        animationFrameId = requestAnimationFrame(predictWebcam);
    }).catch(function(error) {
        console.error("Error during detection:", error);
        animationFrameId = requestAnimationFrame(predictWebcam);
    });
}

function updateResultMatrix(className, score) {
    let existingItem = document.querySelector(`.result-item[data-class="${className}"]`);
    if (existingItem) {
        existingItem.textContent = `${className}: ${Math.round(score * 100)}%`;
        existingItem.classList.add('active');
        setTimeout(() => existingItem.classList.remove('active'), 300);
    } else {
        const newItem = document.createElement('div');
        newItem.className = 'result-item active';
        newItem.setAttribute('data-class', className);
        newItem.textContent = `${className}: ${Math.round(score * 100)}%`;
        resultMatrix.appendChild(newItem);
        setTimeout(() => newItem.classList.remove('active'), 300);
    }
}

function addToConsole(className, score) {
    const consoleItem = document.createElement('div');
    consoleItem.className = 'console-item';
    consoleItem.textContent = `${className} - ${Math.round(score * 100)}%`;
    detectionConsole.insertBefore(consoleItem, detectionConsole.firstChild);
    while (detectionConsole.children.length > 5) {
        detectionConsole.removeChild(detectionConsole.lastChild);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    Tone.start();
    console.log('Tone.js initialized');
});

window.addEventListener('resize', updateCanvasSize);

// Set up drum sequencer
function setupDrumSequencer() {
    const subdivision = '16n';
    let step = 0;

    Tone.Transport.scheduleRepeat((time) => {
        const randomValue = Math.random() * 100;
        let shouldPlay = false;

        switch(currentDrumIndex) {
            case 0:
                shouldPlay = randomValue > randomnessValues.kick;
                if (shouldPlay) kick.triggerAttackRelease(kick.pitch, "16n", time);
                break;
            case 1:
                shouldPlay = randomValue > randomnessValues.snare;
                if (shouldPlay) snare.triggerAttackRelease("16n", time);
                break;
            case 2:
                shouldPlay = randomValue > randomnessValues.hihat;
                if (shouldPlay) hihat.triggerAttackRelease("16n", time);
                break;
            case 3:
                shouldPlay = randomValue > randomnessValues.tom;
                if (shouldPlay) tom.triggerAttackRelease(tom.pitch, "16n", time);
                break;
        }
        step = (step + 1) % 16;
    }, subdivision);

    Tone.Transport.start();
}

setupDrumSequencer();

// Start sequencer when camera starts
enableWebcamButton.addEventListener('click', () => {
    Tone.Transport.start();
});

// Stop sequencer when camera stops
stopWebcamButton.addEventListener('click', () => {
    Tone.Transport.stop();
});