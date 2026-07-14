// =====================================================================
// サウンドエンジン(WebAudio)
// 音声ファイルを使わず、その場で合成する(容量ゼロ・読込ゼロ)。
// SE: タップ/ごはん/レベルアップ/進化/勝利  BGM: やさしいオルゴール風ループ
// 設定は localStorage("hdm_se","hdm_bgm") に保存。
// =====================================================================
let ctx = null;
let bgmTimer = null;
let master = null;

const on = (k) => localStorage.getItem(k) !== "off";
export const seOn = () => on("hdm_se");
export const bgmOn = () => on("hdm_bgm");

/** 初回のタップで呼ぶ(ブラウザの自動再生制限のため) */
export function initSound() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    if (bgmOn()) startBGM();
  } catch { /* 非対応環境は無音で動く */ }
}

function tone(freq, t0, dur, type = "sine", vol = 0.18) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

/** 効果音 */
export function SE(name) {
  if (!ctx || !seOn()) return;
  const t = ctx.currentTime + 0.01;
  switch (name) {
    case "tap":    tone(660, t, 0.07, "triangle", 0.10); break;
    case "nom":    tone(392, t, 0.09, "square", 0.07); tone(294, t + 0.09, 0.12, "square", 0.07); break;
    case "pet":    tone(880, t, 0.06, "sine", 0.08); tone(1174, t + 0.05, 0.09, "sine", 0.07); break;
    case "coin":   tone(988, t, 0.06, "square", 0.07); tone(1319, t + 0.06, 0.14, "square", 0.07); break;
    case "level":  [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.09, 0.22, "triangle", 0.14)); break;
    case "evolve": [392, 494, 587, 784, 988, 1175].forEach((f, i) => tone(f, t + i * 0.11, 0.5, "sine", 0.12));
                   tone(1568, t + 0.66, 0.8, "sine", 0.10); break;
    case "win":    [659, 659, 659, 880].forEach((f, i) => tone(f, t + i * 0.11, i === 3 ? 0.4 : 0.1, "triangle", 0.13)); break;
    case "uno":    tone(740, t, 0.1, "sawtooth", 0.07); tone(988, t + 0.1, 0.22, "sawtooth", 0.07); break;
    case "tickle": [784, 988, 784, 1175].forEach((f, i) => tone(f, t + i * 0.06, 0.07, "triangle", 0.09)); break;
  }
}

/** BGM: ペンタトニックのオルゴール風。2小節をゆっくりループ */
const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];   // C D E G A C
const PATTERN = [0, 2, 4, 3, 5, 4, 2, 1, 0, 2, 3, 4, 2, 1, 0, -1]; // -1=休符
export function startBGM() {
  if (!ctx || bgmTimer) return;
  let step = 0;
  const beat = 0.62;
  bgmTimer = setInterval(() => {
    if (!bgmOn()) return;
    const idx = PATTERN[step % PATTERN.length];
    if (idx >= 0) {
      const t = ctx.currentTime + 0.02;
      tone(SCALE[idx], t, 1.4, "sine", 0.045);
      tone(SCALE[idx] * 2, t, 1.0, "sine", 0.018);           // 倍音でオルゴール感
      if (step % 4 === 0) tone(SCALE[0] / 2, t, 1.8, "sine", 0.03); // ベース
    }
    step++;
  }, beat * 1000);
}
export function stopBGM() { clearInterval(bgmTimer); bgmTimer = null; }

/** 設定変更時に呼ぶ */
export function applySoundSettings() {
  if (!ctx) return;
  if (bgmOn()) startBGM(); else stopBGM();
}
