// Neon Rider - Game Engine (game.js)

const playerCarImg = new Image();
playerCarImg.src = 'fiat_uno_traseira.png';

// --- CONFIGURAÇÕES DE CARROS ---
const CAR_PRESETS = [
    {
        name: 'Cyber Cobra',
        speed: 0.8,
        handling: 0.7,
        primaryColor: '#ff007f', // Neon Pink
        secondaryColor: '#ffffff',
        glowColor: 'rgba(255, 0, 127, 0.8)'
    },
    {
        name: 'Neon Phantom',
        speed: 0.98,
        handling: 0.45,
        primaryColor: '#00f0ff', // Neon Blue
        secondaryColor: '#ffffff',
        glowColor: 'rgba(0, 240, 255, 0.8)'
    },
    {
        name: 'Zenith GTR',
        speed: 0.7,
        handling: 0.95,
        primaryColor: '#39ff14', // Neon Green
        secondaryColor: '#ffffff',
        glowColor: 'rgba(57, 255, 20, 0.8)'
    }
];

// --- DIFICULDADE ---
const DIFFICULTIES = {
    easy: {
        maxSpeed: 200,
        trafficDensity: 3,
        startTime: 60,
        batteryTime: 12,
        trafficChangeLaneChance: 0.0,
        scoreMultiplier: 1
    },
    medium: {
        maxSpeed: 250,
        trafficDensity: 5,
        startTime: 45,
        batteryTime: 10,
        trafficChangeLaneChance: 0.005,
        scoreMultiplier: 1.5
    },
    hard: {
        maxSpeed: 300,
        trafficDensity: 8,
        startTime: 35,
        batteryTime: 8,
        trafficChangeLaneChance: 0.015,
        scoreMultiplier: 2.5
    }
};

// --- ÁUDIO DINÂMICO (WEB AUDIO API) ---
class AudioController {
    constructor() {
        this.ctx = null;
        this.engineOsc = null;
        this.engineGain = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.setupEngineSound();
            this.initialized = true;
        } catch (e) {
            console.error("Web Audio não suportado", e);
        }
    }

    setupEngineSound() {
        if (!this.ctx) return;
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.setValueAtTime(60, this.ctx.currentTime);

        // Filtro passa-baixas para suavizar o motor
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, this.ctx.currentTime);

        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.setValueAtTime(0.0, this.ctx.currentTime); // Começa mutado

        this.engineOsc.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.ctx.destination);
        this.engineOsc.start(0);
    }

    updateEngine(speedRatio) {
        if (!this.ctx || !this.engineOsc) return;
        
        // Ajusta tom do motor baseado na velocidade
        const freq = 55 + (speedRatio * 180);
        this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.1);
        
        // Volume baixo dinâmico
        const vol = 0.03 + (speedRatio * 0.07);
        this.engineGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.1);
    }

    stopEngine() {
        if (this.engineGain) {
            this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        }
    }

    playCoin() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(880, now + 0.08); // A5
        
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
    }

    playCrash() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        
        // Buffer de ruído para som de explosão/batida
        const bufferSize = this.ctx.sampleRate * 0.4;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(100, now);
        filter.frequency.exponentialRampToValueAtTime(10, now + 0.4);
        
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        
        noise.start(now);
    }
}

const audio = new AudioController();

// --- ESTADO DO JOGO ---
let selectedCarIdx = 0;
let currentDifficultyKey = 'easy';

// Configurações do Canvas
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Dimensões originais de desenvolvimento (Proporção)
const V_WIDTH = 900;
const V_HEIGHT = 700;

function resizeCanvas() {
    // Mantém proporção baseada na div pai
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Controles
const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: false,
    ArrowDown: false,
    KeyA: false,
    KeyD: false,
    KeyW: false,
    KeyS: false
};

window.addEventListener('keydown', e => {
    if (e.code in keys) {
        keys[e.code] = true;
        // Inicia áudio no primeiro clique do usuário
        audio.init();
    }
});

window.addEventListener('keyup', e => {
    if (e.code in keys) {
        keys[e.code] = false;
    }
});

// --- CLASSE DO JOGO ---
class Game {
    constructor() {
        this.reset();
    }

    reset() {
        const diff = DIFFICULTIES[currentDifficultyKey];
        const car = CAR_PRESETS[selectedCarIdx];

        this.car = car;
        this.difficulty = diff;

        // Física e Movimento
        this.playerX = 0; // -1 (extrema esquerda) a 1 (extrema direita) da estrada
        this.playerZ = 0; // Distância percorrida
        this.playerY = 0; // Para pulos/efeitos de colisão
        
        this.speed = 0;
        this.maxSpeed = diff.maxSpeed;
        this.accel = 1.8 * (car.speed + 0.2); // Fator de aceleração com base no carro
        this.decel = 2.5;
        this.handling = 0.045 * (car.handling + 0.4);
        
        // Pista Pseudo-3D
        this.segments = [];
        this.segmentLength = 200; // comprimento de cada segmento 3D
        this.roadWidth = 2000;
        this.cameraHeight = 1000;
        this.cameraDepth = null; // definido na inicialização
        this.drawDistance = 300; // Quantos segmentos desenhar à frente

        // Criação de pista procedural
        this.createRoad();

        // Elementos de Jogo
        this.traffic = [];
        this.batteries = [];
        this.particles = [];
        
        this.score = 0;
        this.timeLeft = diff.startTime;
        this.timerInterval = null;
        
        this.isPlaying = false;
        this.isGameOver = false;
        this.screenShake = 0;

        // Spawn timer
        this.lastSpawnZ = 0;
    }

    createRoad() {
        this.segments = [];
        // Gera segmentos da estrada (alguns quilômetros)
        let numSegments = 5000;
        let curveVal = 0;
        let hillVal = 0;

        for (let i = 0; i < numSegments; i++) {
            // Curvas e colinas dinâmicas usando funções trigonométricas
            if (i > 100 && i % 200 === 0) {
                curveVal = (Math.random() - 0.5) * 4.5;
                hillVal = (Math.random() - 0.5) * 120;
            }
            if (i < 100) { // Início reto e plano
                curveVal = 0;
                hillVal = 0;
            }

            this.segments.push({
                index: i,
                p1: { x: 0, y: this.getHillY(i), z: i * this.segmentLength },
                p2: { x: 0, y: this.getHillY(i + 1), z: (i + 1) * this.segmentLength },
                curve: curveVal,
                color: (Math.floor(i / 3) % 2 === 0) ? { road: '#050212', grass: '#0e0421', line: '#ff007f', rumble: '#00f0ff' } : { road: '#09051c', grass: '#0b021a', line: '#9d00ff', rumble: '#0d072b' }
            });
        }

        // Ajusta curvatura de forma acumulada
        let dx = 0;
        for (let i = 0; i < numSegments; i++) {
            dx += this.segments[i].curve;
            this.segments[i].p1.x = dx;
            this.segments[i].p2.x = dx + this.segments[i].curve;
        }
    }

    getHillY(index) {
        return Math.sin(index / 30) * 200 + Math.cos(index / 100) * 100;
    }

    start() {
        this.reset();
        this.isPlaying = true;
        this.isGameOver = false;
        
        // Oculta overlays
        document.querySelectorAll('.gui-overlay').forEach(el => el.classList.add('hidden'));
        document.getElementById('hud').style.display = 'flex';

        // Loop de Tempo
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            if (this.isPlaying && !this.isGameOver) {
                this.timeLeft--;
                if (this.timeLeft <= 0) {
                    this.timeLeft = 0;
                    this.endGame();
                }
                document.getElementById('time-display').textContent = `${this.timeLeft} s`;
            }
        }, 1000);

        audio.init();
    }

    endGame() {
        this.isPlaying = false;
        this.isGameOver = true;
        audio.stopEngine();
        audio.playCrash();

        // Salva pontuação
        const highScores = JSON.parse(localStorage.getItem('neon_rider_highscores') || '[]');
        const key = `${currentDifficultyKey}_${selectedCarIdx}`;
        const prevHigh = highScores[key] || 0;
        let isNewHigh = false;
        
        if (this.score > prevHigh) {
            highScores[key] = this.score;
            localStorage.setItem('neon_rider_highscores', JSON.stringify(highScores));
            isNewHigh = true;
        }

        // Mostra tela final
        document.getElementById('hud').style.display = 'none';
        const gameOverScreen = document.getElementById('game-over');
        gameOverScreen.classList.remove('hidden');

        document.getElementById('final-score').textContent = `${Math.floor(this.score)} m`;
        document.getElementById('final-difficulty').textContent = currentDifficultyKey;
        document.getElementById('final-car').textContent = this.car.name;
        document.getElementById('new-high-score-msg').style.display = isNewHigh ? 'block' : 'none';
    }

    // Projeta coordenadas 3D para 2D com base na câmera
    project(p, cameraX, cameraY, cameraZ, width, height) {
        this.cameraDepth = 1 / Math.tan((60 / 2) * Math.PI / 180); // Campo de visão de 60 graus
        const scale = this.cameraDepth / (p.z - cameraZ);
        
        return {
            x: Math.round((width / 2) + (scale * (p.x - cameraX) * width / 2)),
            y: Math.round((height / 2) - (scale * (p.y - cameraY) * height / 2)),
            w: Math.round(scale * this.roadWidth * width / 2)
        };
    }

    // Adiciona faíscas ou poeira
    createParticle(x, y, color, speedX, speedY, size = 4) {
        this.particles.push({
            x, y,
            vx: speedX,
            vy: speedY,
            color,
            life: 1.0,
            decay: 0.02 + Math.random() * 0.03,
            size
        });
    }

    update() {
        if (!this.isPlaying || this.isGameOver) return;

        // 1. Processa entrada do Jogador
        const left = keys.ArrowLeft || keys.KeyA;
        const right = keys.ArrowRight || keys.KeyD;
        const up = keys.ArrowUp || keys.KeyW;
        const down = keys.ArrowDown || keys.KeyS;

        // Aceleração / Desaceleração
        if (up) {
            this.speed += this.accel;
        } else if (down) {
            this.speed -= this.decel * 2;
        } else {
            this.speed -= this.decel;
        }

        // Limita velocidade
        this.speed = Math.max(0, Math.min(this.speed, this.maxSpeed));
        
        // Som de motor
        audio.updateEngine(this.speed / this.maxSpeed);

        // Movimento lateral (afetado pela velocidade atual)
        const currentTurnSpeed = this.handling * (this.speed / this.maxSpeed);
        if (left) {
            this.playerX -= currentTurnSpeed;
            // Cria faísca/rastro de pneu se estiver em alta velocidade
            if (this.speed > 50) {
                this.createParticle(canvas.width * 0.5 + (this.playerX * 100), canvas.height - 80, '#00f0ff', -2 - Math.random() * 3, Math.random() * 2 - 1, 3);
            }
        }
        if (right) {
            this.playerX += currentTurnSpeed;
            if (this.speed > 50) {
                this.createParticle(canvas.width * 0.5 + (this.playerX * 100), canvas.height - 80, '#00f0ff', 2 + Math.random() * 3, Math.random() * 2 - 1, 3);
            }
        }

        // Limita o jogador a ficar próximo das bordas
        this.playerX = Math.max(-1.5, Math.min(1.5, this.playerX));

        // Avança a posição na estrada
        this.playerZ += this.speed * 0.8;

        // Atualiza pontuação
        this.score += (this.speed / 100) * this.difficulty.scoreMultiplier;
        document.getElementById('score-display').textContent = `${Math.floor(this.score).toString().padStart(6, '0')} m`;
        document.getElementById('speed-display').textContent = `${Math.floor(this.speed)} km/h`;

        // 2. Lógica de Spawning e Tráfego
        if (this.playerZ - this.lastSpawnZ > 600) {
            this.lastSpawnZ = this.playerZ;
            // Chance de spawn de tráfego
            if (this.traffic.length < this.difficulty.trafficDensity) {
                const lane = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
                this.traffic.push({
                    lane,
                    z: this.playerZ + 8000 + Math.random() * 3000,
                    speed: 40 + Math.random() * 60,
                    color: ['#00f0ff', '#ff007f', '#fffb00', '#39ff14'][Math.floor(Math.random() * 4)],
                    width: 0.4,
                    changeLaneTimer: Math.random() * 100
                });
            }

            // Spawn de baterias
            if (this.batteries.length < 2 && Math.random() < 0.4) {
                this.batteries.push({
                    lane: (Math.random() * 2) - 1, // de -1 a 1
                    z: this.playerZ + 9000 + Math.random() * 2000,
                    width: 0.25,
                    collected: false
                });
            }
        }

        // 3. Atualiza tráfego
        for (let i = this.traffic.length - 1; i >= 0; i--) {
            const car = this.traffic[i];
            
            // IA mudando de faixa
            if (this.difficulty.trafficChangeLaneChance > 0) {
                car.changeLaneTimer--;
                if (car.changeLaneTimer <= 0) {
                    car.lane += Math.random() > 0.5 ? 0.4 : -0.4;
                    car.lane = Math.max(-1.1, Math.min(1.1, car.lane));
                    car.changeLaneTimer = 150 + Math.random() * 150;
                }
            }

            car.z += car.speed * 0.8; // Move o veículo do tráfego

            // Deleta tráfego que ficou muito para trás
            if (car.z < this.playerZ - 1000) {
                this.traffic.splice(i, 1);
                continue;
            }

            // Detecção de colisão do jogador com carros do tráfego
            const playerSegmentIdx = Math.floor(this.playerZ / this.segmentLength);
            const carSegmentIdx = Math.floor(car.z / this.segmentLength);

            if (playerSegmentIdx === carSegmentIdx) {
                // Checa proximidade lateral
                const playerLaneX = this.playerX;
                const carLaneX = car.lane;
                const distance = Math.abs(playerLaneX - carLaneX);

                if (distance < 0.35) {
                    // Batida violenta! Reduz velocidade e retira tempo
                    this.speed = 10;
                    this.timeLeft = Math.max(0, this.timeLeft - 10);
                    this.screenShake = 15;
                    audio.playCrash();

                    // Explosão de faíscas
                    for (let p = 0; p < 25; p++) {
                        this.createParticle(
                            canvas.width * 0.5, 
                            canvas.height - 120, 
                            '#ff007f', 
                            (Math.random() - 0.5) * 15, 
                            (Math.random() - 0.5) * 15 - 5, 
                            5
                        );
                    }

                    // Remove carro batido para não bater novamente imediatamente
                    this.traffic.splice(i, 1);
                } else if (distance < 0.6) {
                    // Near miss (Quase batida) - Dá bônus de score!
                    this.score += 50 * this.difficulty.scoreMultiplier;
                    this.createParticle(canvas.width * 0.5, canvas.height - 120, '#fffb00', (Math.random() - 0.5) * 5, -3, 2);
                }
            }
        }

        // 4. Atualiza baterias
        for (let i = this.batteries.length - 1; i >= 0; i--) {
            const battery = this.batteries[i];
            
            if (battery.z < this.playerZ - 1000) {
                this.batteries.splice(i, 1);
                continue;
            }

            const playerSeg = Math.floor(this.playerZ / this.segmentLength);
            const batterySeg = Math.floor(battery.z / this.segmentLength);

            if (playerSeg === batterySeg && !battery.collected) {
                const distance = Math.abs(this.playerX - battery.lane);
                if (distance < 0.4) {
                    battery.collected = true;
                    this.timeLeft += this.difficulty.batteryTime;
                    audio.playCoin();
                    
                    // Faíscas verdes/azuis
                    for (let p = 0; p < 12; p++) {
                        this.createParticle(
                            canvas.width * 0.5, 
                            canvas.height - 120, 
                            '#00f0ff', 
                            (Math.random() - 0.5) * 8, 
                            (Math.random() - 0.5) * 8 - 4, 
                            4
                        );
                    }

                    this.batteries.splice(i, 1);
                }
            }
        }

        // 5. Atualiza partículas
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Efeito de tremer tela
        if (this.screenShake > 0) {
            this.screenShake *= 0.9;
            if (this.screenShake < 0.5) this.screenShake = 0;
        }
    }

    render() {
        ctx.save();
        
        // Efeito de Screen Shake
        if (this.screenShake > 0) {
            const dx = (Math.random() - 0.5) * this.screenShake;
            const dy = (Math.random() - 0.5) * this.screenShake;
            ctx.translate(dx, dy);
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const width = canvas.width;
        const height = canvas.height;

        // Renderiza céu / montanhas neon ao fundo
        const speedRatio = this.speed / this.maxSpeed;
        const bgShift = (this.playerZ * 0.02) % width;
        
        // Desenha a estrada Pseudo-3D
        const playerSegmentIdx = Math.floor(this.playerZ / this.segmentLength);
        const playerSegment = this.segments[playerSegmentIdx];
        
        // Subida/descida do jogador baseada na estrada
        const playerPercent = (this.playerZ % this.segmentLength) / this.segmentLength;
        const playerY = playerSegment.p1.y + (playerSegment.p2.y - playerSegment.p1.y) * playerPercent;

        const cameraX = playerSegment.p1.x + this.playerX * this.roadWidth;
        const cameraY = this.cameraHeight + playerY;

        let maxy = height;
        let x = 0;
        let dx = 0 - (playerSegment.p2.x - playerSegment.p1.x) * playerPercent;

        // Desenha a estrada de trás para frente (Back to Front)
        for (let i = 0; i < this.drawDistance; i++) {
            const segment = this.segments[(playerSegmentIdx + i) % this.segments.length];
            const looped = segment.index < playerSegmentIdx;
            
            // Loop de coordenadas se passar do fim do vetor da pista
            const loopConstant = looped ? this.segments.length * this.segmentLength : 0;

            const p1 = this.project(segment.p1, cameraX - dx, cameraY, this.playerZ - loopConstant, width, height);
            const p2 = this.project(segment.p2, cameraX - dx - segment.curve, cameraY, this.playerZ - loopConstant, width, height);

            dx = dx + segment.curve;

            if (p1.y >= maxy || p1.y < 0 || p2.y >= p1.y) continue;

            // Desenha as partes da pista
            this.drawSegment(ctx, width, p1.x, p1.y, p1.w, p2.x, p2.y, p2.w, segment.color);
            maxy = p1.y;
        }

        // Desenha colecionáveis (Baterias)
        for (const battery of this.batteries) {
            const relativeZ = battery.z - this.playerZ;
            if (relativeZ > 0 && relativeZ < this.drawDistance * this.segmentLength) {
                const segIdx = Math.floor(battery.z / this.segmentLength) % this.segments.length;
                const segment = this.segments[segIdx];
                const loopConstant = battery.z < this.playerZ ? this.segments.length * this.segmentLength : 0;
                
                // Calcula posição X com base na curvatura da pista
                const dx = segment.p1.x - cameraX;
                const p = this.project(
                    { x: segment.p1.x + (battery.lane * this.roadWidth * 0.8), y: segment.p1.y + 120, z: battery.z },
                    cameraX, cameraY, this.playerZ - loopConstant, width, height
                );

                if (p.y > 0 && p.y < height) {
                    this.drawBattery(ctx, p.x, p.y, p.w * battery.width);
                }
            }
        }

        // Desenha tráfego
        for (const enemy of this.traffic) {
            const relativeZ = enemy.z - this.playerZ;
            if (relativeZ > 0 && relativeZ < this.drawDistance * this.segmentLength) {
                const segIdx = Math.floor(enemy.z / this.segmentLength) % this.segments.length;
                const segment = this.segments[segIdx];
                const loopConstant = enemy.z < this.playerZ ? this.segments.length * this.segmentLength : 0;
                
                const p = this.project(
                    { x: segment.p1.x + (enemy.lane * this.roadWidth * 0.8), y: segment.p1.y, z: enemy.z },
                    cameraX, cameraY, this.playerZ - loopConstant, width, height
                );

                if (p.y > 0 && p.y < height) {
                    this.drawEnemyCar(ctx, p.x, p.y, p.w * enemy.width, enemy.color);
                }
            }
        }

        // Desenha Partículas
        for (const p of this.particles) {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;

        // Desenha Carro do Jogador (sempre renderizado à frente, na parte inferior)
        // Adiciona um pequeno efeito dinâmico baseado no movimento/curva do jogador
        let steerAngle = 0;
        if (keys.ArrowLeft || keys.KeyA) steerAngle = -0.15;
        if (keys.ArrowRight || keys.KeyD) steerAngle = 0.15;
        
        this.drawPlayerCar(ctx, width / 2, height - 70, 160, steerAngle);

        ctx.restore();
    }

    drawSegment(ctx, width, x1, y1, w1, x2, y2, w2, color) {
        // Grama/Background lateral
        ctx.fillStyle = color.grass;
        ctx.fillRect(0, y2, width, y1 - y2);

        // Faixa de Rumble (bordas brilhantes)
        const r1 = w1 * 0.08;
        const r2 = w2 * 0.08;
        ctx.fillStyle = color.rumble;
        ctx.beginPath();
        ctx.moveTo(x1 - w1 - r1, y1);
        ctx.lineTo(x1 - w1, y1);
        ctx.lineTo(x2 - w2, y2);
        ctx.lineTo(x2 - w2 - r2, y2);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(x1 + w1, y1);
        ctx.lineTo(x1 + w1 + r1, y1);
        ctx.lineTo(x2 + w2 + r2, y2);
        ctx.lineTo(x2 + w2, y2);
        ctx.fill();

        // Estrada Principal
        ctx.fillStyle = color.road;
        ctx.beginPath();
        ctx.moveTo(x1 - w1, y1);
        ctx.lineTo(x1 + w1, y1);
        ctx.lineTo(x2 + w2, y2);
        ctx.lineTo(x2 - w2, y2);
        ctx.fill();

        // Linhas centrais separadoras de pista (se for tracejada)
        ctx.fillStyle = color.line;
        const lineW1 = w1 * 0.015;
        const lineW2 = w2 * 0.015;
        
        // Desenha duas faixas tracejadas centrais
        const numLanes = 3;
        for (let lane = 1; lane < numLanes; lane++) {
            const laneOffset1 = -w1 + (w1 * 2 / numLanes) * lane;
            const laneOffset2 = -w2 + (w2 * 2 / numLanes) * lane;
            
            ctx.beginPath();
            ctx.moveTo(x1 + laneOffset1 - lineW1/2, y1);
            ctx.lineTo(x1 + laneOffset1 + lineW1/2, y1);
            ctx.lineTo(x2 + laneOffset2 + lineW2/2, y2);
            ctx.lineTo(x2 + laneOffset2 - lineW2/2, y2);
            ctx.fill();
        }
    }

    drawPlayerCar(ctx, x, y, width, steerAngle) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(steerAngle);

        const h = width * 0.5;

        // Efeito de Brilho Sob o Carro (Neon Glow)
        const gradientGlow = ctx.createRadialGradient(0, 0, 10, 0, 0, width * 0.7);
        gradientGlow.addColorStop(0, this.car.glowColor || 'rgba(255, 0, 127, 0.8)');
        gradientGlow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradientGlow;
        ctx.beginPath();
        ctx.ellipse(0, 0, width * 0.7, h * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Desenha a imagem do Fiat Uno de traseira
        if (playerCarImg.complete && playerCarImg.naturalWidth !== 0) {
            const imgWidth = width * 1.25; // Ajusta escala para visualização ideal
            const imgHeight = imgWidth * (playerCarImg.naturalHeight / playerCarImg.naturalWidth);
            // Desenha a imagem centralizada no ponto x, y (0, 0 local)
            ctx.drawImage(playerCarImg, -imgWidth / 2, -imgHeight / 2 - 15, imgWidth, imgHeight);
        } else {
            // Fallback: Desenho vetorial antigo caso a imagem falhe ao carregar
            ctx.fillStyle = '#222';
            ctx.strokeStyle = this.car.primaryColor;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-width * 0.4, h * 0.3);
            ctx.lineTo(-width * 0.35, -h * 0.2);
            ctx.lineTo(width * 0.35, -h * 0.2);
            ctx.lineTo(width * 0.4, h * 0.3);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = this.car.primaryColor;
            ctx.fillRect(-width * 0.45, h * 0.2, width * 0.9, h * 0.15);

            ctx.fillStyle = '#ff0055';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ff0055';
            ctx.fillRect(-width * 0.38, h * 0.16, width * 0.2, h * 0.06);
            ctx.fillRect(width * 0.18, h * 0.16, width * 0.2, h * 0.06);
        }

        ctx.restore();
    }

    drawEnemyCar(ctx, x, y, width, primaryColor) {
        if (width < 2) return;
        ctx.save();
        ctx.translate(x, y);

        const h = width * 0.55;

        // Sombra sob o carro
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(0, 0, width * 0.55, h * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Rodas traseiras visíveis
        ctx.fillStyle = '#111';
        ctx.fillRect(-width * 0.45, -h * 0.2, width * 0.12, h * 0.4);
        ctx.fillRect(width * 0.33, -h * 0.2, width * 0.12, h * 0.4);

        // Corpo
        ctx.fillStyle = '#1e1a2f';
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-width * 0.38, h * 0.2);
        ctx.lineTo(-width * 0.32, -h * 0.3);
        ctx.lineTo(width * 0.32, -h * 0.3);
        ctx.lineTo(width * 0.38, h * 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Vidro Traseiro
        ctx.fillStyle = 'rgba(0, 240, 255, 0.6)';
        ctx.beginPath();
        ctx.moveTo(-width * 0.22, 0);
        ctx.lineTo(-width * 0.18, -h * 0.2);
        ctx.lineTo(width * 0.18, -h * 0.2);
        ctx.lineTo(width * 0.22, 0);
        ctx.closePath();
        ctx.fill();

        // Lanternas traseiras
        ctx.fillStyle = '#ff003c';
        ctx.fillRect(-width * 0.32, h * 0.1, width * 0.12, h * 0.08);
        ctx.fillRect(width * 0.2, h * 0.1, width * 0.12, h * 0.08);

        ctx.restore();
    }

    drawBattery(ctx, x, y, width) {
        if (width < 2) return;
        ctx.save();
        ctx.translate(x, y);

        // Efeito flutuante de rotação baseada no tempo
        const bounce = Math.sin(Date.now() / 150) * 10;
        ctx.translate(0, bounce - 40);

        // Brilho da bateria
        const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, width * 1.5);
        glow.addColorStop(0, 'rgba(0, 240, 255, 0.8)');
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, width * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Bateria Holográfica Neon
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 3;
        ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
        
        ctx.beginPath();
        ctx.rect(-width * 0.4, -width * 0.6, width * 0.8, width * 1.2);
        ctx.fill();
        ctx.stroke();

        // Polo positivo
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(-width * 0.15, -width * 0.8, width * 0.3, width * 0.2);

        // Raio brilhante no meio da bateria
        ctx.fillStyle = '#fffb00';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#fffb00';
        ctx.beginPath();
        ctx.moveTo(0, -width * 0.3);
        ctx.lineTo(width * 0.2, -width * 0.05);
        ctx.lineTo(-width * 0.1, 0);
        ctx.lineTo(width * 0.1, width * 0.3);
        ctx.lineTo(-width * 0.2, 0.05);
        ctx.lineTo(0.1, 0);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}

// Instancia o jogo
const game = new Game();

// Loop principal de Render e Update
function gameLoop() {
    game.update();
    game.render();
    requestAnimationFrame(gameLoop);
}

// Inicia loop
requestAnimationFrame(gameLoop);

// --- INTERACTION / BINDINGS DE MENU ---

document.getElementById('btn-play').addEventListener('click', () => {
    game.start();
});

document.getElementById('btn-garage').addEventListener('click', () => {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('garage-menu').classList.remove('hidden');
});

document.getElementById('btn-tutorial').addEventListener('click', () => {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('tutorial-menu').classList.remove('hidden');
});

document.getElementById('btn-tutorial-back').addEventListener('click', () => {
    document.getElementById('tutorial-menu').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
});

document.getElementById('btn-garage-back').addEventListener('click', () => {
    document.getElementById('garage-menu').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
});

document.getElementById('btn-restart').addEventListener('click', () => {
    game.start();
});

document.getElementById('btn-menu').addEventListener('click', () => {
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
});

// Seletores de Dificuldade
document.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', e => {
        document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentDifficultyKey = e.target.getAttribute('data-diff');
    });
});

// Seletores de Carros na Garagem
document.querySelectorAll('.car-card').forEach(card => {
    card.addEventListener('click', e => {
        document.querySelectorAll('.car-card').forEach(c => c.classList.remove('selected'));
        const targetCard = e.currentTarget;
        targetCard.classList.add('selected');
        selectedCarIdx = parseInt(targetCard.getAttribute('data-car'));
    });
});

// Previews procedurais de carros na garagem
function drawPreviews() {
    const cars = ['cobra', 'phantom', 'zenith'];
    cars.forEach((carId, idx) => {
        const previewContainer = document.getElementById(`preview-${carId}`);
        if (!previewContainer) return;
        
        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = 70;
        previewCanvas.height = 100;
        previewContainer.appendChild(previewCanvas);
        
        const pCtx = previewCanvas.getContext('2d');
        const pGame = new Game();
        pGame.car = CAR_PRESETS[idx];
        
        // Simula frame do jogador na garagem
        pGame.drawPlayerCar(pCtx, 35, 50, 50, 0);
    });
}
// Desenha os previews depois de carregar a página
window.addEventListener('load', drawPreviews);
