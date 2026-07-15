// =====================================================================
// しんけいすいじゃく(対戦ゲーム)
// ノーマル: 50枚(25ペア) / ハード: 100枚(50ペア)
// そろえたら続けて自分の番。ペア数が多いほうの勝ち。
// =====================================================================
import { txMatch } from "../core/match.js";
import { S, personOf, partnerUid } from "../core/state.js";
import { esc } from "../core/ui.js";
import { addCoins, addFood, bumpStat, recordResult } from "../core/economy.js";
import { gainExp, addPersonality } from "../pet/pet.js";
import { logH } from "../core/history.js";
import { SE } from "../core/sound.js";
import { confetti } from "../core/ui.js";

// 50ペアぶんの絵柄(ハードで全部使う。ノーマルは前から25種)
export const EMOJIS = [
  "🍓","🍒","🍑","🍊","🍋","🍉","🍇","🍎","🥝","🍍","🍌","🫐","🍈",
  "🍰","🧁","🍩","🍪","🍮","🍬","🍭","🍫","🍡","🥞","🍧","🍦",
  "☕","🧋","🌸","🌻","🌷","🍀","🍁","🌙","⭐","🌈",
  "🎈","🎀","🎁","🧸","☂️","🔔",
  "🐰","🐻","🐱","🐶","🐹","🐥","🦊","🐢","🦋",
];

const MODES = {
  normal: { name: "ノーマル", pairs: 25, cols: 10 },
  hard:   { name: "ハード",   pairs: 50, cols: 10 },
};

export function buildBoard(pairs) {
  const ids = [];
  for (let i = 0; i < pairs; i++) ids.push(i, i);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

const scoreOf = (d, uid) => Object.values(d.taken || {}).filter((u) => u === uid).length;
const other = (m, uid) => (m.players.a === uid ? m.players.b : m.players.a);

let advTimer = null; // めくった2枚を見せたあと自動で進めるタイマー

export default {
  id: "memory",
  name: "しんけいすいじゃく",
  icon: "🃏",
  desc: "きおく力しょうぶ! そろえた数が多いほうの勝ち",
  rules: "こうごにカードを2枚めくって、同じ絵ならゲット(もう1回めくれる)。<br>ぜんぶ無くなったとき、ペア数が多いほうの勝ち!<br>ノーマル=50枚 / ハード=100枚",

  initData() {
    // モードはホストがゲーム内で選ぶ(基盤を変えないための設計)
    return { phase: "mode" };
  },

  statsHtml(st) {
    const g = st.byGame?.memory || {};
    return `<span>せんせき ${g.wins || 0}勝${(g.played || 0) - (g.wins || 0) - (g.draws || 0)}敗${g.draws ? `${g.draws}分` : ""}</span>`;
  },

  render(el, m) {
    const d = m.data;
    const isHost = m.invitedBy === S.uid;

    // ---- モード選択(ホストのみ操作) ----
    if (d.phase === "mode") {
      el.innerHTML = isHost ? `
        <p class="center" style="margin:14px 0 6px">むずかしさを えらんでね</p>
        <div class="mode-btns">
          ${Object.entries(MODES).map(([k, v]) => `
            <button class="mode-btn" data-mode="${k}">
              <b>${v.name}</b><span>${v.pairs * 2}枚 (${v.pairs}ペア)</span>
            </button>`).join("")}
        </div>`
        : `<p class="center waiting-dots" style="margin-top:40px">あいてが むずかしさを えらんでいます</p>`;
      el.querySelectorAll("[data-mode]").forEach((b) => {
        b.onclick = () => txMatch((mm) => {
          if (mm.status !== "active" || mm.data.phase !== "mode") return false;
          const mode = b.dataset.mode;
          mm.data = {
            phase: "play", mode,
            cards: buildBoard(MODES[mode].pairs),
            taken: {}, flipped: [],
            turn: mm.invitedBy,          // さそった人が先攻
            reveal: null,
          };
          mm.updatedAt = Date.now();
          return mm;
        });
      });
      return;
    }

    // ---- 盤面 ----
    const mode = MODES[d.mode];
    const pu = partnerUid();
    const meP = personOf(S.uid), paP = personOf(pu);
    const myScore = scoreOf(d, S.uid), paScore = scoreOf(d, pu);
    const remain = d.cards.length - Object.keys(d.taken || {}).length;
    const myTurn = d.turn === S.uid;
    const flipped = d.flipped || [];
    const showIdx = new Set(flipped);
    if (d.phase === "reveal" && d.reveal) { showIdx.add(d.reveal.a); showIdx.add(d.reveal.b); }

    el.innerHTML = `
      <div class="mem-top">
        <span class="mem-chip" style="--pc:${meP.color}">${meP.emoji}${myScore}</span>
        <span class="mem-info">${mode.name}・のこり${remain}枚<br>
          <b class="${myTurn ? "mem-turn" : ""}">${myTurn ? "あなたの番!" : `${esc(paP.name)}の番`}</b></span>
        <span class="mem-chip" style="--pc:${paP.color}">${paP.emoji}${paScore}</span>
      </div>
      <div class="mem-grid mode-${d.mode}" style="--cols:${mode.cols}">
        ${d.cards.map((id, i) => {
          if (d.taken?.[i]) return `<span class="mc gone"></span>`;
          const open = showIdx.has(i);
          // ペア成立の瞬間だけ、そろった2枚に赤丸を重ねる
          const isMatchPair = d.phase === "reveal" && d.reveal?.matched && (i === d.reveal.a || i === d.reveal.b);
          return `<button class="mc ${open ? "open" : ""} ${isMatchPair ? "matched" : ""}" data-i="${i}" ${open || !myTurn || d.phase !== "play" ? "disabled" : ""}>
            ${open ? EMOJIS[id] : "🐾"}${isMatchPair ? `<i class="mc-ring"></i>` : ""}</button>`;
        }).join("")}
      </div>`;

    el.querySelectorAll(".mc[data-i]").forEach((b) => {
      b.onclick = () => this.flip(+b.dataset.i);
    });

    // ペア成立=約1秒そのまま見せてから処理 / はずれ=1.1秒見せてから交代
    if (d.phase === "reveal") {
      clearTimeout(advTimer);
      const wait = d.reveal?.matched ? 1000 : 1100;
      advTimer = setTimeout(() => this.advance(), wait);
    }
  },

  flip(i) {
    return txMatch((m) => {
      if (m.status !== "active" || m.gameId !== this.id) return false;
      const d = m.data;
      if (d.phase !== "play" || d.turn !== S.uid) return false;
      if (d.taken?.[i] || (d.flipped || []).includes(i)) return false;
      d.flipped = [...(d.flipped || []), i];
      if (d.flipped.length === 2) {
        const [a, b] = d.flipped;
        const matched = d.cards[a] === d.cards[b];
        // 成立しても取得処理は advance で行う(演出中はカードを表示したままにするため)
        d.reveal = { a, b, matched, ts: Date.now() };
        d.phase = "reveal";
        d.flipped = [];
      }
      m.updatedAt = Date.now();
      return m;
    });
  },

  advance() {
    return txMatch((m) => {
      if (m.status !== "active" || m.gameId !== this.id) return false;
      const d = m.data;
      if (d.phase !== "reveal" || !d.reveal) return false;
      const { a, b, matched } = d.reveal;
      if (matched) {
        // 演出が終わったこのタイミングで取得済みにする
        d.taken = { ...(d.taken || {}), [a]: d.turn, [b]: d.turn };
      } else {
        d.turn = other(m, d.turn);   // はずれたら交代
      }
      const done = Object.keys(d.taken || {}).length >= d.cards.length;
      d.reveal = null;
      d.phase = "play";
      if (done) m.status = "result";
      m.updatedAt = Date.now();
      return m;
    });
  },

  renderResult(m) {
    const d = m.data;
    const pu = partnerUid();
    const my = scoreOf(d, S.uid), pa = scoreOf(d, pu);
    const meP = personOf(S.uid), paP = personOf(pu);
    const msg = my === pa ? "ひきわけ! いい勝負!" : my > pa ? `${esc(meP.name)}の勝ち!` : `${esc(paP.name)}の勝ち!`;
    return `
      <div class="result-icon">🃏</div>
      <h2>${msg}</h2>
      <div class="result-stars">${my} - ${pa}</div>
      <p>${MODES[d.mode].name}(${d.cards.length}枚)</p>
      <p class="result-reward">🪙 かち+${d.mode === "hard" ? 60 : 40} / まけ+15 / ひきわけ+25ずつ<br>🍚+1ずつ / ペットに ✨+${d.mode === "hard" ? 40 : 25}</p>`;
  },

  summary(m) {
    const d = m.data;
    const sc = {};
    for (const uid of Object.values(d.taken || {})) sc[uid] = (sc[uid] || 0) + 1;
    return { kind: "vs", mode: d.mode, scores: sc };
  },
  async rewards(m, isHost) {
    const d = m.data;
    const my = scoreOf(d, S.uid), pa = scoreOf(d, partnerUid());
    const res = my === pa ? "draw" : my > pa ? "win" : "lose";
    if (!isHost) {
      await addCoins(res === "win" ? (d.mode === "hard" ? 60 : 40) : res === "draw" ? 25 : 15);
      await addFood(1);
      await recordResult("memory", res);
      logH("game", { gameId: "memory", mode: d.mode, score: my, result: res });
      if (res === "win") { confetti(30); SE("win"); } SE("win");
    } else {
      await gainExp(d.mode === "hard" ? 40 : 25, "しんけいすいじゃく");
      await addPersonality("monoshiri", 2);
    }
  },
};
