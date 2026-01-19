/* --- BYTESTACK STATION v5.0 (SPOTIFY EDITION) --- */

// --- 1. STATE & STORAGE ---
const savedSettings = JSON.parse(localStorage.getItem('byteStack_settings'));
// URL Padrão: Lofi Girl Playlist
const defaultSpotify = "https://open.spotify.com/embed/playlist/0vvXsWCC9xrXsKd4FyS8kM";

let settings = savedSettings || { 
    focus: 25, short: 5, long: 15,
    spotifyUrl: defaultSpotify 
};

const savedStats = JSON.parse(localStorage.getItem('byteStack_stats'));
let stats = savedStats || { totalMinutes: 0, cycle: 1 };

let state = {
    timeLeft: settings.focus * 60,
    totalTime: settings.focus * 60,
    isRunning: false,
    mode: 'focus', 
    cycle: stats.cycle
};

// --- 2. DOM ELEMENTS ---
const elDisplay = document.getElementById('timerDisplay');
const elCircle = document.getElementById('progressCircle');
const elStatus = document.getElementById('statusText');
const elPlayBtn = document.getElementById('playBtn');
const elAudioBtn = document.getElementById('audioBtn');
const elSidebar = document.getElementById('sidebar');
const taskInput = document.getElementById('taskInput');
const taskEst = document.getElementById('taskEst');
const taskList = document.getElementById('taskList');
const toastEl = document.getElementById('toast');
const toastMsg = document.getElementById('toastMsg');
const spotifyFrame = document.getElementById('spotifyFrame');

// --- 3. INIT & THEME ---
function loadTheme() {
    const savedTheme = localStorage.getItem('byteStack_theme');
    if (savedTheme) document.body.className = savedTheme;
}
function toggleTheme() {
    const body = document.body;
    let newTheme = ''; let msg = 'Matrix';
    if (!body.classList.contains('theme-purple') && !body.classList.contains('theme-orange')) { newTheme = 'theme-purple'; msg = 'Cyberpunk'; } 
    else if (body.classList.contains('theme-purple')) { newTheme = 'theme-orange'; msg = 'Sunset'; } 
    else { newTheme = ''; }
    body.className = newTheme;
    localStorage.setItem('byteStack_theme', newTheme);
    showToast(`Tema: ${msg}`); playClickSound();
}

// Carregar Spotify
function initSpotify() {
    if(settings.spotifyUrl) {
        spotifyFrame.src = settings.spotifyUrl;
        document.getElementById('inputSpotify').value = settings.spotifyUrl.replace('/embed', ''); // Mostra link limpo no input
    } else {
        spotifyFrame.src = defaultSpotify;
    }
}

// --- 4. AUDIO SYSTEM & VISUALIZER ---
let audioCtx, analyser, currentOscillators = [], audioMode = 0;
const modesText = ['🔇 Off', '🤎 Foco', '🌧️ Chuva', '🌊 Fluxo'];
const canvas = document.getElementById('audioVisualizer');
const ctx = canvas.getContext('2d');

function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}
function stopAudio() {
    currentOscillators.forEach(n => { try{ n.stop(); n.disconnect(); }catch(e){} });
    currentOscillators = [];
}
function createNoise(type) {
    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        if (type === 'brown') { data[i] = (lastOut + (0.02 * white)) / 1.02; lastOut = data[i]; data[i] *= 3.5; } 
        else { data[i] = white * 0.5; }
    }
    const noise = audioCtx.createBufferSource(); noise.buffer = buffer; noise.loop = true;
    analyser = audioCtx.createAnalyser(); analyser.fftSize = 128;
    const gain = audioCtx.createGain(); gain.gain.value = 0.05;
    noise.connect(gain); gain.connect(analyser); gain.connect(audioCtx.destination);
    noise.start(); currentOscillators.push(noise); drawVisualizer();
}
function drawVisualizer() {
    if (audioMode === 0 || !analyser) { ctx.clearRect(0,0, canvas.width, canvas.height); return; }
    requestAnimationFrame(drawVisualizer);
    canvas.width = window.innerWidth; canvas.height = 250;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);
    const barWidth = (canvas.width / bufferLength) * 2.5;
    let x = 0;
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--primary').trim();
    for(let i=0; i<bufferLength; i++) {
        let barHeight = dataArray[i];
        ctx.globalAlpha = 0.3; ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
    }
}
function cycleAudio() {
    playClickSound(); initAudio(); stopAudio();
    audioMode = (audioMode + 1) % 4;
    elAudioBtn.textContent = modesText[audioMode];
    elAudioBtn.style.color = audioMode === 0 ? "var(--text-muted)" : "var(--primary)";
    if (audioMode === 1) createNoise('brown');
    if (audioMode === 2) createNoise('pink');
    if (audioMode === 3) createNoise('white');
    showToast(`Gerador: ${modesText[audioMode].replace('🔇 ','').replace('🤎 ','').replace('🌧️ ','').replace('🌊 ','')}`);
}

// --- 5. TIMER LOGIC ---
let timerId = null;
const circumference = elCircle.r.baseVal.value * 2 * Math.PI;
elCircle.style.strokeDasharray = `${circumference} ${circumference}`;

function updateTimerUI() {
    const m = Math.floor(state.timeLeft / 60);
    const s = state.timeLeft % 60;
    const timeString = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    elDisplay.textContent = timeString;
    document.title = `${timeString} • ByteStack`;
    const percent = ((state.totalTime - state.timeLeft) / state.totalTime);
    elCircle.style.strokeDashoffset = circumference - (percent * 100 / 100) * circumference;
}
function toggleTimer() {
    playClickSound();
    if (state.isRunning) { clearInterval(timerId); state.isRunning = false; elPlayBtn.textContent = "CONTINUAR"; elPlayBtn.style.background = "var(--text-main)"; } 
    else {
        initAudio(); state.isRunning = true; elPlayBtn.textContent = "PAUSAR"; elPlayBtn.style.background = "var(--primary)";
        timerId = setInterval(() => {
            state.timeLeft--; updateTimerUI();
            if (state.mode === 'focus' && state.timeLeft % 60 === 0) { stats.totalMinutes++; document.getElementById('sessionMinutes').textContent = stats.totalMinutes; saveAllData(); }
            if (state.timeLeft <= 0) finishCycle();
        }, 1000);
    }
}
function finishCycle() {
    clearInterval(timerId); state.isRunning = false; playAlarm();
    if(Notification.permission==="granted") new Notification("Ciclo Completo!");
    if (state.mode === 'focus') { state.cycle < 4 ? switchMode('short') : switchMode('long'); } 
    else { state.cycle = (state.cycle === 4) ? 1 : state.cycle + 1; switchMode('focus'); }
    saveAllData();
}
function switchMode(newMode) {
    state.mode = newMode;
    state.timeLeft = (newMode === 'focus' ? settings.focus : newMode === 'short' ? settings.short : settings.long) * 60;
    state.totalTime = state.timeLeft;
    if(newMode === 'focus') { elStatus.textContent = "RUMO AO FOCO"; elStatus.style.color = "var(--primary)"; elCircle.style.stroke = "var(--primary)"; } 
    else { elStatus.textContent = "PAUSA " + (newMode === 'short' ? "CURTA" : "LONGA"); elStatus.style.color = "#fff"; elCircle.style.stroke = "#fff"; }
    elPlayBtn.textContent = "PRÓXIMO"; updateTimerUI(); updateCycleDots(); showToast(`Modo: ${newMode.toUpperCase()}`);
}
function resetTimer() { playClickSound(); clearInterval(timerId); state.isRunning = false; elPlayBtn.textContent = "INICIAR"; elPlayBtn.style.background = "var(--primary)"; state.timeLeft = (state.mode === 'focus' ? settings.focus : state.mode === 'short' ? settings.short : settings.long) * 60; state.totalTime = state.timeLeft; updateTimerUI(); }

// --- 6. TASK MANAGER ---
function addTask() {
    const text = taskInput.value.trim(); const est = taskEst.value;
    if(!text) return;
    playClickSound();
    let dots = ''; for(let i=0; i<est; i++) dots += '<span class="tomato-dot">○</span>';
    const li = document.createElement('li'); li.className = 'task-item';
    li.innerHTML = `<div class="check-box"></div><span style="flex:1">${text}</span><span class="estimates">${dots}</span>`;
    li.onclick = function(e) {
        if(e.target.className === 'tomato-dot') {
            e.target.textContent = e.target.textContent === '○' ? '●' : '○'; e.target.classList.toggle('dot-full'); saveAllData(); return;
        }
        playClickSound(); this.classList.toggle('done'); updateTaskCount(); saveAllData();
    };
    taskList.prepend(li); taskInput.value = ''; updateTaskCount(); saveAllData();
    if(window.innerWidth > 800) taskInput.focus();
}
function saveAllData() { localStorage.setItem('byteStack_settings', JSON.stringify(settings)); localStorage.setItem('byteStack_stats', JSON.stringify({totalMinutes: stats.totalMinutes, cycle: state.cycle})); localStorage.setItem('byteStack_tasks', taskList.innerHTML); }
function loadTasks() {
    const t = localStorage.getItem('byteStack_tasks');
    if(t) {
        taskList.innerHTML = t;
        document.querySelectorAll('.task-item').forEach(li => {
            li.onclick = function(e) { 
                if(e.target.className === 'tomato-dot') { e.target.textContent = e.target.textContent === '○' ? '●' : '○'; e.target.classList.toggle('dot-full'); saveAllData(); return; }
                playClickSound(); this.classList.toggle('done'); updateTaskCount(); saveAllData(); 
            };
        });
        updateTaskCount();
    }
}

// --- 7. CONFIG & HELPERS ---
function playClickSound() {
    initAudio(); const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(300, audioCtx.currentTime); osc.type='triangle';
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
    osc.start(); osc.stop(audioCtx.currentTime + 0.05);
}
function playAlarm() {
    initAudio(); const osc=audioCtx.createOscillator(); const g=audioCtx.createGain();
    osc.connect(g); g.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.5);
    g.gain.setValueAtTime(0.1, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime+0.5);
    osc.start(); osc.stop(audioCtx.currentTime+0.5);
}
function showToast(msg) { toastMsg.textContent=msg; toastEl.classList.add('show'); setTimeout(()=>toastEl.classList.remove('show'),3000); }
function updateTaskCount(){ const c=document.querySelectorAll('.task-item:not(.done)').length; document.getElementById('mobileTaskCount').textContent=c; }
function updateCycleDots(){ for(let i=1;i<=4;i++){ document.getElementById(`step${i}`).classList.toggle('active', i===state.cycle); }}
function toggleSettings(){ playClickSound(); document.getElementById('settingsModal').classList.toggle('open'); }
function skipPhase(){ playClickSound(); state.timeLeft=0; finishCycle(); }
function toggleMobileSidebar(){ playClickSound(); elSidebar.classList.toggle('open'); }

// SALVAR CONFIGURAÇÕES (INCLUINDO SPOTIFY)
function saveSettings(){
    settings.focus = parseInt(document.getElementById('inputFocus').value);
    settings.short = parseInt(document.getElementById('inputShort').value);
    settings.long = parseInt(document.getElementById('inputLong').value);
    
    // Tratamento de URL do Spotify
    let rawUrl = document.getElementById('inputSpotify').value.trim();
    if(rawUrl) {
        if(!rawUrl.includes('/embed') && rawUrl.includes('open.spotify.com')) {
            // Converte link normal para embed
            rawUrl = rawUrl.replace('open.spotify.com/', 'open.spotify.com/embed/');
        }
        settings.spotifyUrl = rawUrl;
        initSpotify(); // Atualiza iframe
    }

    saveAllData(); toggleSettings(); resetTimer(); showToast("Config Salva");
}

async function togglePiP() {
    playClickSound();
    if(document.pictureInPictureElement) document.exitPictureInPicture();
    else {
        const v = document.createElement('video'); v.muted=true;
        const cvs = document.createElement('canvas'); cvs.width=500; cvs.height=500;
        const cx = cvs.getContext('2d');
        cx.fillStyle='#111'; cx.fillRect(0,0,500,500);
        cx.fillStyle='#fff'; cx.font='100px sans-serif'; cx.fillText("ByteStack", 50, 250);
        v.srcObject=cvs.captureStream(); v.play();
        try{ await v.requestPictureInPicture(); }catch(e){ showToast("Erro PiP"); }
    }
}

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') { if(e.key==='Escape')e.target.blur(); return; }
    if(e.code==='Space'){e.preventDefault(); toggleTimer();}
    if(e.code==='KeyR')resetTimer(); if(e.code==='KeyS')cycleAudio(); if(e.code==='KeyT')toggleTheme(); if(e.code==='KeyP')togglePiP();
    if(e.code==='KeyN'){e.preventDefault(); toggleMobileSidebar(); setTimeout(()=>taskInput.focus(),100);}
});

// Init
loadTheme();
loadTasks();
initSpotify();
document.getElementById('sessionMinutes').textContent = stats.totalMinutes;
updateTimerUI();