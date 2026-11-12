/**
 * Brick Breaker — a classic paddle-and-ball arcade game on a single canvas.
 * No dependencies. All state lives in this closure; the best score is kept in localStorage.
 */
(function () {
    'use strict';

    // ── Playfield (logical pixels; the canvas is scaled to fit with CSS) ──────
    const W = 800;
    const H = 600;

    const COLS = 12;
    const SIDE = 30;
    const TOP = 64;
    const BRICK_GAP = 4;
    const BRICK_H = 22;
    const BRICK_W = (W - SIDE * 2 - BRICK_GAP * (COLS - 1)) / COLS;

    const PADDLE_Y = H - 44;
    const PADDLE_H = 14;
    const PADDLE_W = 112;
    const PADDLE_WIDE = 172;
    const PADDLE_KEY_SPEED = 640;

    const BALL_R = 7;
    const MAX_BALLS = 8;
    const BASE_SPEED = 360;
    const SPEED_PER_LEVEL = 28;
    const SPEED_PER_HIT = 2.5;
    const MAX_LEVEL_SPEED = 560;
    const MAX_SPEED = 700;
    const MIN_VERTICAL = 0.2; // keeps the ball from skimming sideways forever

    const START_LIVES = 3;
    const MAX_LIVES = 5;
    const DROP_CHANCE = 0.14;
    const DROP_SPEED = 150;
    const WIDE_SECONDS = 15;
    const SLOW_SECONDS = 10;
    const SLOW_FACTOR = 0.7;

    const BEST_KEY = 'bang-brick-breaker-best';
    const MUTE_KEY = 'bang-brick-breaker-muted';

    // '#' one hit · 'S' two hits · 'T' three hits · 'X' unbreakable · '.' empty
    const LEVELS = [
        [
            '############',
            '############',
            '############',
            '############',
            '############',
        ],
        [
            '.....##.....',
            '....####....',
            '...######...',
            '..########..',
            '.##########.',
            '############',
        ],
        [
            'SSSSSSSSSSSS',
            '############',
            '............',
            '############',
            '#.#.#.#.#.#.',
            '.#.#.#.#.#.#',
            'SS........SS',
        ],
        [
            '############',
            '#..######..#',
            '#.X.####.X.#',
            '############',
            'SS..XXXX..SS',
            '############',
        ],
        [
            '.....##.....',
            '....#SS#....',
            '...#STTS#...',
            '..#ST##TS#..',
            '...#STTS#...',
            '....#SS#....',
            '.....##.....',
            'X..X....X..X',
        ],
    ];

    const ROW_COLORS = ['#f87171', '#fb923c', '#fbbf24', '#4ade80', '#22d3ee', '#60a5fa', '#a78bfa', '#f472b6'];
    const ARMOR_COLORS = ['#94a3b8', '#cbd5e1', '#f1f5f9']; // by hits remaining (1, 2, 3)
    const BRICK_HP = { '#': 1, S: 2, T: 3, X: Infinity };

    const DROPS = {
        wide: { label: 'W', color: '#38bdf8', weight: 4 },
        multi: { label: 'M', color: '#a78bfa', weight: 3 },
        slow: { label: 'S', color: '#34d399', weight: 3 },
        life: { label: '+1', color: '#fb7185', weight: 1 },
    };

    // ── DOM ───────────────────────────────────────────────────────────────────
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const el = {
        score: document.getElementById('hud-score'),
        best: document.getElementById('hud-best'),
        level: document.getElementById('hud-level'),
        lives: document.getElementById('hud-lives'),
        overlay: document.getElementById('overlay'),
        overlayTitle: document.getElementById('overlay-title'),
        overlayText: document.getElementById('overlay-text'),
        overlayBtn: document.getElementById('overlay-btn'),
        pauseBtn: document.getElementById('pause-btn'),
        muteBtn: document.getElementById('mute-btn'),
        restartBtn: document.getElementById('restart-btn'),
    };
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ── Storage (may be unavailable in private windows) ───────────────────────
    function load(key) {
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    }

    function save(key, value) {
        try {
            localStorage.setItem(key, String(value));
        } catch {
            // Nothing to do: the game works without persistence.
        }
    }

    // ── State ─────────────────────────────────────────────────────────────────
    let state = 'menu'; // menu | playing | paused | cleared | over
    let overlayAction = null;
    let score = 0;
    let best = Number(load(BEST_KEY)) || 0;
    let lives = START_LIVES;
    let level = 1;
    let speed = BASE_SPEED;
    let remaining = 0;
    let wideTime = 0;
    let slowTime = 0;
    let muted = load(MUTE_KEY) === 'true';
    let bricks = [];
    let balls = [];
    let drops = [];
    let particles = [];
    const paddle = { x: (W - PADDLE_W) / 2, w: PADDLE_W };
    const keys = { left: false, right: false };

    // ── Sound (tiny synthesised beeps; created on first use after a gesture) ──
    let audio = null;

    function beep(freq, duration, type, volume) {
        if (muted) return;
        try {
            audio = audio || new (window.AudioContext || window.webkitAudioContext)();
            if (audio.state === 'suspended') audio.resume();
            const now = audio.currentTime;
            const osc = audio.createOscillator();
            const gain = audio.createGain();
            osc.type = type || 'square';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(volume || 0.04, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
            osc.connect(gain);
            gain.connect(audio.destination);
            osc.start(now);
            osc.stop(now + duration);
        } catch {
            // Audio is optional.
        }
    }

    const sfx = {
        paddle: () => beep(220, 0.07),
        wall: () => beep(160, 0.04, 'square', 0.025),
        brick: row => beep(760 - row * 55, 0.07),
        armor: () => beep(300, 0.06, 'triangle', 0.06),
        solid: () => beep(120, 0.05, 'triangle', 0.06),
        launch: () => beep(440, 0.08, 'triangle', 0.05),
        power: () => {
            beep(520, 0.08, 'triangle', 0.05);
            setTimeout(() => beep(780, 0.12, 'triangle', 0.05), 80);
        },
        lose: () => {
            beep(200, 0.15, 'sawtooth', 0.05);
            setTimeout(() => beep(130, 0.3, 'sawtooth', 0.05), 140);
        },
        clear: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.14, 'triangle', 0.05), i * 110)),
    };

    // ── Helpers ───────────────────────────────────────────────────────────────
    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    function setPaddleCenter(x) {
        paddle.x = clamp(x - paddle.w / 2, 0, W - paddle.w);
    }

    function setPaddleWidth(w) {
        const center = paddle.x + paddle.w / 2;
        paddle.w = w;
        setPaddleCenter(center);
    }

    function newStuckBall() {
        return { x: paddle.x + paddle.w / 2, y: PADDLE_Y - BALL_R, dx: 0, dy: -1, stuck: true };
    }

    /** Keep the direction a unit vector with a minimum vertical component. */
    function fixDirection(ball) {
        if (Math.abs(ball.dy) < MIN_VERTICAL) {
            ball.dy = (ball.dy < 0 ? -1 : 1) * MIN_VERTICAL;
            ball.dx = (ball.dx < 0 ? -1 : 1) * Math.sqrt(1 - MIN_VERTICAL * MIN_VERTICAL);
        }
    }

    function levelSpeed(n) {
        return Math.min(BASE_SPEED + (n - 1) * SPEED_PER_LEVEL, MAX_LEVEL_SPEED);
    }

    function addScore(points) {
        score += points;
        if (score > best) best = score;
        updateHud();
    }

    // ── HUD / overlay ─────────────────────────────────────────────────────────
    function updateHud() {
        el.score.textContent = score.toLocaleString();
        el.best.textContent = best.toLocaleString();
        el.level.textContent = String(level);
        el.lives.textContent = String(lives);
    }

    function updateButtons() {
        const paused = state === 'paused';
        el.pauseBtn.disabled = state !== 'playing' && !paused;
        el.pauseBtn.innerHTML = paused
            ? '<i class="fa-solid fa-play"></i><span>Resume</span>'
            : '<i class="fa-solid fa-pause"></i><span>Pause</span>';
        el.muteBtn.innerHTML = muted
            ? '<i class="fa-solid fa-volume-xmark"></i><span>Sound off</span>'
            : '<i class="fa-solid fa-volume-high"></i><span>Sound on</span>';
        el.muteBtn.setAttribute('aria-pressed', String(!muted));
    }

    function showOverlay(title, text, buttonLabel, action) {
        el.overlayTitle.textContent = title;
        el.overlayText.textContent = text;
        el.overlayBtn.textContent = buttonLabel;
        overlayAction = action;
        el.overlay.classList.remove('hidden');
        el.overlayBtn.focus({ preventScroll: true });
        updateButtons();
    }

    function hideOverlay() {
        overlayAction = null;
        el.overlay.classList.add('hidden');
        canvas.focus({ preventScroll: true });
        updateButtons();
    }

    // ── Game flow ─────────────────────────────────────────────────────────────
    function setupLevel(n) {
        const layout = LEVELS[(n - 1) % LEVELS.length];
        bricks = [];
        remaining = 0;
        layout.forEach((line, row) => {
            for (let col = 0; col < COLS; col++) {
                const kind = line[col];
                if (!BRICK_HP[kind]) continue;
                bricks.push({
                    x: SIDE + col * (BRICK_W + BRICK_GAP),
                    y: TOP + row * (BRICK_H + BRICK_GAP),
                    row,
                    kind,
                    hp: BRICK_HP[kind],
                    alive: true,
                });
                if (kind !== 'X') remaining++;
            }
        });
        speed = levelSpeed(n);
        resetField();
    }

    /** Clear effects and falling items, and put a fresh ball on the paddle. */
    function resetField() {
        drops = [];
        wideTime = 0;
        slowTime = 0;
        paddle.w = PADDLE_W;
        setPaddleCenter(W / 2);
        balls = [newStuckBall()];
    }

    function newGame() {
        score = 0;
        lives = START_LIVES;
        level = 1;
        particles = [];
        setupLevel(level);
        state = 'playing';
        updateHud();
        hideOverlay();
    }

    function nextLevel() {
        level++;
        setupLevel(level);
        state = 'playing';
        updateHud();
        hideOverlay();
    }

    function pause() {
        if (state !== 'playing') return;
        state = 'paused';
        showOverlay('Paused', 'Take a breath. The ball will wait.', 'Resume', resume);
    }

    function resume() {
        if (state !== 'paused') return;
        state = 'playing';
        hideOverlay();
    }

    function levelCleared() {
        state = 'cleared';
        const bonus = lives * 100;
        addScore(bonus);
        save(BEST_KEY, best);
        sfx.clear();
        showOverlay(`Level ${level} cleared!`, `Bonus for lives left: +${bonus}. The ball gets faster from here.`, 'Next level', nextLevel);
    }

    function loseLife() {
        lives--;
        save(BEST_KEY, best);
        sfx.lose();
        updateHud();
        if (lives <= 0) {
            state = 'over';
            const record = score > 0 && score === best;
            showOverlay(
                'Game over',
                `You scored ${score.toLocaleString()} and reached level ${level}.${record ? ' That is a new best!' : ''}`,
                'Play again',
                newGame,
            );
            return;
        }
        speed = levelSpeed(level);
        resetField();
    }

    function launch() {
        if (state !== 'playing') return;
        let launched = false;
        for (const ball of balls) {
            if (!ball.stuck) continue;
            const angle = (Math.random() - 0.5) * 0.6;
            ball.dx = Math.sin(angle);
            ball.dy = -Math.cos(angle);
            ball.stuck = false;
            launched = true;
        }
        if (launched) sfx.launch();
    }

    // ── Power-ups ─────────────────────────────────────────────────────────────
    function maybeDrop(brick) {
        if (drops.length >= 3 || Math.random() > DROP_CHANCE) return;
        const types = Object.keys(DROPS).filter(t => t !== 'life' || lives < MAX_LIVES);
        const total = types.reduce((sum, t) => sum + DROPS[t].weight, 0);
        let roll = Math.random() * total;
        const type = types.find(t => (roll -= DROPS[t].weight) < 0) || types[0];
        drops.push({ type, x: brick.x + BRICK_W / 2, y: brick.y + BRICK_H / 2 });
    }

    function applyDrop(type) {
        sfx.power();
        addScore(25);
        if (type === 'wide') {
            wideTime = WIDE_SECONDS;
            setPaddleWidth(PADDLE_WIDE);
        } else if (type === 'slow') {
            slowTime = SLOW_SECONDS;
        } else if (type === 'life') {
            lives = Math.min(lives + 1, MAX_LIVES);
            updateHud();
        } else if (type === 'multi') {
            const sources = balls.filter(b => !b.stuck);
            for (const src of sources) {
                for (const angle of [-0.4, 0.4]) {
                    if (balls.length >= MAX_BALLS) return;
                    const cos = Math.cos(angle);
                    const sin = Math.sin(angle);
                    const ball = {
                        x: src.x,
                        y: src.y,
                        dx: src.dx * cos - src.dy * sin,
                        dy: src.dx * sin + src.dy * cos,
                        stuck: false,
                    };
                    fixDirection(ball);
                    balls.push(ball);
                }
            }
        }
    }

    // ── Physics ───────────────────────────────────────────────────────────────
    function brickColor(brick) {
        if (brick.kind === 'X') return '#334155';
        if (brick.kind === '#') return ROW_COLORS[brick.row % ROW_COLORS.length];
        return ARMOR_COLORS[brick.hp - 1];
    }

    function burst(brick) {
        if (reduceMotion) return;
        const color = brickColor(brick);
        for (let i = 0; i < 8; i++) {
            particles.push({
                x: brick.x + Math.random() * BRICK_W,
                y: brick.y + Math.random() * BRICK_H,
                vx: (Math.random() - 0.5) * 220,
                vy: (Math.random() - 0.6) * 220,
                life: 0.45,
                color,
            });
        }
    }

    function damage(brick) {
        if (brick.kind === 'X') {
            sfx.solid();
            return;
        }
        brick.hp--;
        if (brick.hp > 0) {
            sfx.armor();
            return;
        }
        burst(brick);
        brick.alive = false;
        remaining--;
        speed = Math.min(speed + SPEED_PER_HIT, MAX_SPEED);
        sfx.brick(brick.row);
        addScore(brick.kind === '#' ? 10 * Math.max(1, 6 - brick.row) : brick.kind === 'S' ? 60 : 100);
        maybeDrop(brick);
    }

    /** Bounce off the brick the ball overlaps most deeply (if any). */
    function collideBricks(ball) {
        let hit = null;
        let hitDist = BALL_R * BALL_R;
        let nx = 0;
        let ny = 0;
        for (const brick of bricks) {
            if (!brick.alive) continue;
            const dx = ball.x - clamp(ball.x, brick.x, brick.x + BRICK_W);
            const dy = ball.y - clamp(ball.y, brick.y, brick.y + BRICK_H);
            const dist = dx * dx + dy * dy;
            if (dist < hitDist) {
                hit = brick;
                hitDist = dist;
                nx = dx;
                ny = dy;
            }
        }
        if (!hit) return;

        if (nx === 0 && ny === 0) {
            // Centre is inside the brick: leave through the nearest face.
            const left = ball.x - hit.x;
            const right = hit.x + BRICK_W - ball.x;
            const top = ball.y - hit.y;
            const bottom = hit.y + BRICK_H - ball.y;
            const nearest = Math.min(left, right, top, bottom);
            if (nearest === left) nx = -1;
            else if (nearest === right) nx = 1;
            else if (nearest === top) ny = -1;
            else ny = 1;
        }

        if (Math.abs(nx) > Math.abs(ny)) {
            ball.dx = (nx > 0 ? 1 : -1) * Math.abs(ball.dx);
            ball.x = nx > 0 ? hit.x + BRICK_W + BALL_R : hit.x - BALL_R;
        } else {
            ball.dy = (ny > 0 ? 1 : -1) * Math.abs(ball.dy);
            ball.y = ny > 0 ? hit.y + BRICK_H + BALL_R : hit.y - BALL_R;
        }
        fixDirection(ball);
        damage(hit);
    }

    function collidePaddle(ball) {
        if (ball.dy <= 0) return;
        if (ball.y + BALL_R < PADDLE_Y || ball.y - BALL_R > PADDLE_Y + PADDLE_H) return;
        if (ball.x < paddle.x - BALL_R || ball.x > paddle.x + paddle.w + BALL_R) return;
        // Where the ball lands on the paddle decides the outgoing angle (up to 60° either way).
        const offset = clamp((ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2), -1, 1);
        const angle = offset * (Math.PI / 3);
        ball.dx = Math.sin(angle);
        ball.dy = -Math.cos(angle);
        ball.y = PADDLE_Y - BALL_R;
        sfx.paddle();
    }

    /** Move a ball in small steps so it cannot tunnel through bricks. Returns false when lost. */
    function moveBall(ball, distance) {
        const steps = Math.max(1, Math.ceil(distance / 4));
        const step = distance / steps;
        for (let i = 0; i < steps; i++) {
            ball.x += ball.dx * step;
            ball.y += ball.dy * step;

            if (ball.x < BALL_R) {
                ball.x = BALL_R;
                ball.dx = Math.abs(ball.dx);
                sfx.wall();
            } else if (ball.x > W - BALL_R) {
                ball.x = W - BALL_R;
                ball.dx = -Math.abs(ball.dx);
                sfx.wall();
            }
            if (ball.y < BALL_R) {
                ball.y = BALL_R;
                ball.dy = Math.abs(ball.dy);
                sfx.wall();
            }

            collidePaddle(ball);
            collideBricks(ball);
            if (state !== 'playing') return true;
            if (ball.y - BALL_R > H) return false;
        }
        return true;
    }

    function update(dt) {
        if (keys.left !== keys.right) {
            paddle.x = clamp(paddle.x + (keys.left ? -1 : 1) * PADDLE_KEY_SPEED * dt, 0, W - paddle.w);
        }

        if (wideTime > 0) {
            wideTime -= dt;
            if (wideTime <= 0) setPaddleWidth(PADDLE_W);
        }
        if (slowTime > 0) slowTime -= dt;

        const distance = speed * (slowTime > 0 ? SLOW_FACTOR : 1) * dt;
        balls = balls.filter(ball => {
            if (ball.stuck) {
                ball.x = paddle.x + paddle.w / 2;
                ball.y = PADDLE_Y - BALL_R;
                return true;
            }
            return moveBall(ball, distance);
        });

        drops = drops.filter(drop => {
            drop.y += DROP_SPEED * dt;
            const caught = drop.y + 8 >= PADDLE_Y && drop.y - 8 <= PADDLE_Y + PADDLE_H
                && drop.x >= paddle.x - 16 && drop.x <= paddle.x + paddle.w + 16;
            if (caught) applyDrop(drop.type);
            return !caught && drop.y < H + 20;
        });

        if (state !== 'playing') return;
        if (remaining <= 0) levelCleared();
        else if (balls.length === 0) loseLife();
    }

    function updateParticles(dt) {
        particles = particles.filter(p => {
            p.life -= dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 600 * dt;
            return p.life > 0;
        });
    }

    // ── Rendering ─────────────────────────────────────────────────────────────
    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
        else ctx.rect(x, y, w, h);
    }

    function drawBricks() {
        for (const brick of bricks) {
            if (!brick.alive) continue;
            ctx.fillStyle = brickColor(brick);
            roundRect(brick.x, brick.y, BRICK_W, BRICK_H, 4);
            ctx.fill();
            if (brick.kind === '#') {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.fillRect(brick.x + 4, brick.y + 3, BRICK_W - 8, 3);
            } else {
                ctx.strokeStyle = brick.kind === 'X' ? '#64748b' : 'rgba(15, 23, 42, 0.45)';
                ctx.lineWidth = 2;
                roundRect(brick.x + 4, brick.y + 4, BRICK_W - 8, BRICK_H - 8, 2);
                ctx.stroke();
            }
        }
    }

    function drawPaddle() {
        const gradient = ctx.createLinearGradient(0, PADDLE_Y, 0, PADDLE_Y + PADDLE_H);
        gradient.addColorStop(0, wideTime > 0 ? '#7dd3fc' : '#e2e8f0');
        gradient.addColorStop(1, wideTime > 0 ? '#0284c7' : '#64748b');
        ctx.fillStyle = gradient;
        roundRect(paddle.x, PADDLE_Y, paddle.w, PADDLE_H, PADDLE_H / 2);
        ctx.fill();
    }

    function drawBalls() {
        ctx.save();
        ctx.shadowColor = slowTime > 0 ? '#34d399' : '#f8fafc';
        ctx.shadowBlur = 10;
        ctx.fillStyle = slowTime > 0 ? '#a7f3d0' : '#f8fafc';
        for (const ball of balls) {
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    function drawDrops() {
        ctx.font = '700 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const drop of drops) {
            const def = DROPS[drop.type];
            ctx.fillStyle = def.color;
            roundRect(drop.x - 17, drop.y - 9, 34, 18, 9);
            ctx.fill();
            ctx.fillStyle = '#0f172a';
            ctx.fillText(def.label, drop.x, drop.y + 1);
        }
    }

    function drawStatus() {
        ctx.font = '600 13px Inter, sans-serif';
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
        const active = [];
        if (wideTime > 0) active.push(`WIDE ${Math.ceil(wideTime)}s`);
        if (slowTime > 0) active.push(`SLOW ${Math.ceil(slowTime)}s`);
        if (active.length) {
            ctx.fillStyle = '#94a3b8';
            ctx.fillText(active.join('   '), 12, H - 10);
        }
        if (state === 'playing' && balls.some(b => b.stuck)) {
            ctx.textAlign = 'center';
            ctx.font = '600 16px Inter, sans-serif';
            ctx.fillStyle = '#cbd5e1';
            ctx.fillText('Click, tap or press Space to launch', W / 2, PADDLE_Y - 60);
        }
    }

    function render() {
        ctx.fillStyle = '#0b1220';
        ctx.fillRect(0, 0, W, H);
        drawBricks();
        for (const p of particles) {
            ctx.globalAlpha = clamp(p.life / 0.45, 0, 1);
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
        }
        ctx.globalAlpha = 1;
        drawDrops();
        drawPaddle();
        drawBalls();
        drawStatus();
    }

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cssWidth = canvas.clientWidth || W;
        canvas.width = Math.round(cssWidth * dpr);
        canvas.height = Math.round(cssWidth * (H / W) * dpr);
        ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    }

    let lastTime = 0;

    function frame(time) {
        const dt = Math.min((time - lastTime) / 1000, 1 / 30);
        lastTime = time;
        if (state === 'playing') update(dt);
        if (state !== 'paused') updateParticles(dt);
        render();
        requestAnimationFrame(frame);
    }

    // ── Input ─────────────────────────────────────────────────────────────────
    function pointerX(event) {
        const rect = canvas.getBoundingClientRect();
        return (event.clientX - rect.left) * (W / rect.width);
    }

    window.addEventListener('pointermove', event => {
        if (state === 'playing') setPaddleCenter(pointerX(event));
    });

    canvas.addEventListener('pointerdown', event => {
        if (state !== 'playing') return;
        setPaddleCenter(pointerX(event));
        launch();
    });

    function setKey(event, down) {
        const key = event.key.toLowerCase();
        if (key === 'arrowleft' || key === 'a') keys.left = down;
        else if (key === 'arrowright' || key === 'd') keys.right = down;
        else return false;
        return true;
    }

    window.addEventListener('keydown', event => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        const onControl = event.target instanceof HTMLElement && event.target.closest('button, a, input, select, textarea');
        if (setKey(event, true)) {
            if (!onControl) event.preventDefault();
            return;
        }
        const key = event.key.toLowerCase();
        if (key === ' ' || key === 'enter') {
            if (onControl) return; // let the focused button handle it
            event.preventDefault();
            if (overlayAction) overlayAction();
            else launch();
        } else if (key === 'p' || key === 'escape') {
            if (state === 'playing') pause();
            else if (state === 'paused') resume();
        } else if (key === 'm') {
            toggleMute();
        }
    });

    window.addEventListener('keyup', event => setKey(event, false));

    function toggleMute() {
        muted = !muted;
        save(MUTE_KEY, muted);
        updateButtons();
    }

    el.overlayBtn.addEventListener('click', () => {
        if (overlayAction) overlayAction();
    });
    el.pauseBtn.addEventListener('click', () => (state === 'paused' ? resume() : pause()));
    el.muteBtn.addEventListener('click', toggleMute);
    el.restartBtn.addEventListener('click', newGame);

    window.addEventListener('blur', () => {
        keys.left = false;
        keys.right = false;
        pause();
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) pause();
    });
    window.addEventListener('resize', resize);

    // ── Boot ──────────────────────────────────────────────────────────────────
    resize();
    setupLevel(1);
    updateHud();
    showOverlay('Ready?', 'Break every brick. Do not let the ball fall past the paddle.', 'Start game', newGame);
    requestAnimationFrame(time => {
        lastTime = time;
        requestAnimationFrame(frame);
    });
})();
