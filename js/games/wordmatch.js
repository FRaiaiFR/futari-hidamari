// =====================================================================
// いしんでんしんワード(協力ゲーム)
// お題に2人が同時に答えて、一致したらポイント。全5問。
// =====================================================================
import { txMatch } from "../core/match.js";
import { S, personOf, partnerUid, on } from "../core/state.js";
import { esc } from "../core/ui.js";
import { TOPICS } from "../data/masters.js";
import { toYomi } from "../data/yomi.js";
import { addCoins, bumpStat } from "../core/economy.js";
import { gainExp, addPersonality } from "../pet/pet.js";
import { logH } from "../core/history.js";
import { r, push } from "../core/firebase.js";

const ROUNDS = 5;

// ---- 入力の下書き保持 ----------------------------------------------
// 相手の送信やDB更新で画面が再描画されても、未送信の入力が消えないよう
// ラウンドごとにローカルへ下書きを保持する。試合が終わったら破棄。
let drafts = {};
let wmTick = null;
function clearWmTick() { if (wmTick) { clearInterval(wmTick); wmTick = null; } }
on("match:idle", () => { drafts = {}; clearWmTick(); });

/** ひらがな寄せの正規化(カタカナ→ひらがな、空白除去、小文字化) */
function norm(s) {
  return String(s || "").trim().toLowerCase().replace(/[\s　]/g, "")
    .replace(/[\u30a1-\u30f6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

export default {
  id: "wordmatch",
  name: "いしんでんしんワード",
  icon: "💭",
  desc: "おなじ言葉を思いうかべられたら成功!",
  rules: `お題を見て、2人が同時に答えを入力。<br>一致したら💞!全${ROUNDS}問、ふたりで何回そろうかな?`,

  initData() {
    const pool = [...TOPICS];
    const topics = [];
    for (let i = 0; i < ROUNDS; i++) {
      topics.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    return { round: 1, phase: "input", topics, answers: {}, results: [], matches: 0, roundStart: Date.now() };
  },

  render(el, m) {
    const d = m.data;
    const topic = d.topics[d.round - 1];
    const myAns = d.answers?.[S.uid];

    if (d.phase === "input") {
      if (myAns != null) {
        clearWmTick();
        el.innerHTML = `
          ${head(d)}
          <div class="wm-topic">${esc(topic)}</div>
          <p class="center">あなたの答え: <b>${myAns ? esc(myAns) : "(むかいてなかった…)"}</b></p>
          <p class="center waiting-dots">あいての答えを まっています</p>`;
        return;
      }
      el.innerHTML = `
        ${head(d)}
        <div class="wm-timer"><svg viewBox="0 0 40 40"><circle class="wm-ring-bg" cx="20" cy="20" r="17"/><circle class="wm-ring" cx="20" cy="20" r="17" id="wm-ring"/></svg><span id="wm-sec">5</span></div>
        <div class="wm-topic">${esc(topic)}</div>
        <div class="wm-form">
          <input class="wm-input" maxlength="12" placeholder="ぱっと思いついた言葉" autocomplete="off">
          <button class="btn btn-primary btn-big wm-go">これでいく!</button>
        </div>`;
      const input = el.querySelector(".wm-input");
      // 相手の送信などで再描画されても、書きかけの言葉を復元する
      input.value = drafts[d.round] || "";
      input.addEventListener("input", () => { drafts[d.round] = input.value; });
      input.focus();
      try { const n = input.value.length; input.setSelectionRange(n, n); } catch { /* 非対応は無視 */ }
      let submitted = false;
      const submit = (auto = false) => {
        if (submitted) return;
        const w = input.value.trim();
        if (!w && !auto) return;         // 手動送信は空欄不可、自動提出は空欄OK
        submitted = true;
        clearWmTick();
        delete drafts[d.round];
        this.submit(w);                  // 空欄なら "" が入る
      };
      el.querySelector(".wm-go").onclick = () => submit(false);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(false); });

      // ---- 5秒タイマー(残り0で自動提出) ----
      this.startWmTimer(el, d, () => submit(true));
      return;
    }

    // reveal
    clearWmTick();
    const res = d.results[d.results.length - 1];
    const pu = partnerUid();
    const meP = personOf(S.uid), paP = personOf(pu);
    const showWord = (w) => w ? esc(w) : "─";
    el.innerHTML = `
      ${head(d)}
      <div class="wm-topic small">${esc(res.topic)}</div>
      <div class="wm-reveal ${res.matched ? "hit" : ""}">
        <div class="wm-ans" style="--pc:${meP.color}"><span>${meP.emoji} ${esc(meP.name)}</span><b>${showWord(res.words[S.uid])}</b></div>
        <div class="wm-vs">${res.matched ? "💞" : "💭"}</div>
        <div class="wm-ans" style="--pc:${paP.color}"><span>${paP.emoji} ${esc(paP.name)}</span><b>${showWord(res.words[pu])}</b></div>
      </div>
      <p class="wm-judge">${res.matched ? "ぴったり!いしんでんしん!" : "おしい…それも らしいね"}</p>
      <button class="btn btn-primary btn-big wm-next">${d.round >= ROUNDS ? "けっかを見る" : "つぎのお題へ"}</button>`;
    el.querySelector(".wm-next").onclick = () => this.next();
  },

  submit(word) {
    return txMatch((m) => {
      if (m.status !== "active" || m.gameId !== this.id) return false;
      const d = m.data;
      if (d.phase !== "input" || d.answers?.[S.uid] != null) return false;
      d.answers = { ...(d.answers || {}), [S.uid]: word };
      // 2人そろったら判定
      const uids = [m.players.a, m.players.b];
      if (uids.every((u) => d.answers[u] != null)) {
        const y0 = toYomi(d.answers[uids[0]]), y1 = toYomi(d.answers[uids[1]]);
        const matched = y0 !== "" && y0 === y1;   // 読みが一致(空欄同士は不一致)
        d.results = [...(d.results || []),
          { topic: d.topics[d.round - 1], words: { ...d.answers }, matched }];
        if (matched) d.matches = (d.matches || 0) + 1;
        d.phase = "reveal";
      }
      m.updatedAt = Date.now();
      return m;
    });
  },

  next() {
    clearWmTick();
    return txMatch((m) => {
      if (m.status !== "active" || m.gameId !== this.id || m.data.phase !== "reveal") return false;
      const d = m.data;
      if (d.round >= ROUNDS) {
        m.status = "result";
      } else {
        d.round += 1;
        d.phase = "input";
        d.answers = {};
        d.roundStart = Date.now();
      }
      m.updatedAt = Date.now();
      return m;
    });
  },

  /** 5秒タイマー(共有の roundStart を基準にするので両者ほぼ同期) */
  startWmTimer(el, d, onTimeout) {
    clearWmTick();
    const ring = el.querySelector("#wm-ring");
    const secEl = el.querySelector("#wm-sec");
    const CIRC = 2 * Math.PI * 17;
    if (ring) ring.style.strokeDasharray = CIRC;
    const update = () => {
      const elapsed = (Date.now() - (d.roundStart || Date.now())) / 1000;
      const left = Math.max(0, 5 - elapsed);
      if (secEl) secEl.textContent = Math.ceil(left);
      if (ring) { ring.style.strokeDashoffset = CIRC * (1 - left / 5); ring.classList.toggle("danger", left <= 2); }
      if (left <= 0) { clearWmTick(); onTimeout(); }
    };
    update();
    wmTick = setInterval(update, 100);
  },

  renderResult(m) {
    const n = m.data.matches || 0;
    const stars = "💞".repeat(n) + "▫️".repeat(ROUNDS - n);
    const msg = n >= 4 ? "ふたりは いしんでんしん!" : n >= 2 ? "いい感じに つうじあってる!" : "のびしろは たっぷり!";
    return `
      <div class="result-icon">💭</div>
      <h2>${n} / ${ROUNDS} 回 一致!</h2>
      <div class="result-stars">${stars}</div>
      <p>${msg}</p>
      <p class="result-reward">🪙 +${10 + n * 10} ずつ / ペットに ✨+${n * 10 + 10}</p>`;
  },

  /** isHost=false: 自分の分 / true: ペット・共有の分(1回だけ) */
  /** 対戦きろく用の要約(⑮) */
  summary(m) {
    const d = m.data;
    return { kind: "coop", matches: d.matches || 0, rounds: (d.results || []).map((x) => ({
      t: x.topic, w: x.words || null, hit: !!x.matched })) };
  },
  async rewards(m, isHost) {
    const n = m.data.matches || 0;
    if (!isHost) {
      await addCoins(10 + n * 10);
      await bumpStat("byGame/wordmatch/played");
      await bumpStat("wordMatchTotal", n);
      logH("game", { gameId: "wordmatch", matches: n });
    } else {
      await gainExp(n * 10 + 10, "ことばあわせ");
      if (n > 0) await addPersonality("nakayoshi", n);
      // 一致した言葉は「ふたりのじてん」へ
      for (const res of m.data.results || []) {
        if (res.matched) {
          push(r("shared/dictionary"), {
            ts: Date.now(), topic: res.topic, word: Object.values(res.words)[0],
          }).catch(() => {});
        }
      }
    }
  },
};

function head(d) {
  return `<div class="wm-head">おだい <b>${d.round}</b> / ${ROUNDS} <span class="wm-score">💞×${d.matches || 0}</span></div>`;
}
