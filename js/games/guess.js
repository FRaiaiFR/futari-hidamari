// =====================================================================
// かずあてゲーム(1対1オンライン対戦) — 全面刷新版
// ・1〜100の数字グリッド / 各自 回答3回・ヒント3回 / 60秒タイマー
// ・ヒントは答えから逆算生成(重複なし・ランダム性あり)
// ・回答/ヒント/タイムアウトをゲームログにリアルタイム表示
// ・タイムアウトで自動パス / 終了後リマッチ
// 設計: ロジック(純関数) / 通信(txMatch) / UI(render) を分離
// =====================================================================
import { txMatch } from "../core/match.js";
import { S, personOf, partnerUid } from "../core/state.js";
import { esc, confetti, modal } from "../core/ui.js";
import { addCoins, addFood, recordResult } from "../core/economy.js";
import { gainExp, addPersonality } from "../pet/pet.js";
import { logH } from "../core/history.js";
import { SE } from "../core/sound.js";

const TRIES = 3;        // 回答回数/人
const HINTS = 3;        // ヒント回数/人
const TURN_SEC = 60;    // 1手番の制限時間

// ---- 純粋ロジック層 --------------------------------------------------
const seatOf = (m, uid) => (m.players.a === uid ? "a" : "b");
const otherSeat = (s) => (s === "a" ? "b" : "a");
const isPrime = (n) => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
const isSquare = (n) => Number.isInteger(Math.sqrt(n));

/** 答えから逆算したヒントを1つ生成(既出kindは避ける・ランダム性あり・難易度中) */
export function makeHint(answer, usedKinds) {
  const cands = [];
  // 範囲系(ほどよくヒントになる幅にする)
  const lo = Math.max(1, answer - (8 + Math.floor(Math.random() * 12)));
  const hi = Math.min(100, answer + (8 + Math.floor(Math.random() * 12)));
  cands.push({ kind: "gt", text: `${lo - 1}より大きい`, lo: lo, hiEx: 100 });
  cands.push({ kind: "lt", text: `${hi + 1}より小さい`, lo: 1, hi: hi });
  cands.push({ kind: "between", text: `${lo}〜${hi}のあいだ`, lo, hi });
  cands.push({ kind: "parity", text: answer % 2 === 0 ? "偶数" : "奇数", parity: answer % 2 });
  if (isPrime(answer)) cands.push({ kind: "prime", text: "素数" });
  else cands.push({ kind: "notprime", text: "素数ではない" });
  if (answer % 5 === 0) cands.push({ kind: "mul5", text: "5の倍数" });
  else cands.push({ kind: "notmul5", text: "5の倍数ではない" });
  if (answer % 10 === 0) cands.push({ kind: "mul10", text: "10の倍数" });
  else cands.push({ kind: "notmul10", text: "10の倍数ではない" });
  cands.push({ kind: "tens", text: `十の位は ${Math.floor(answer / 10)}` });
  cands.push({ kind: "ones", text: `一の位は ${answer % 10}` });
  cands.push({ kind: "digitsum", text: `数字の和は ${String(answer).split("").reduce((a, b) => a + +b, 0)}` });
  if (isSquare(answer)) cands.push({ kind: "square", text: "平方数(なにかの2乗)" });
  else cands.push({ kind: "notsquare", text: "平方数ではない" });

  const pool = cands.filter((c) => !usedKinds.includes(c.kind));
  const use = pool.length ? pool : cands;
  return use[Math.floor(Math.random() * use.length)];
}

/** ヒントから「薄く表示する数字」を計算(選択は可能) */
export function dimSet(hints) {
  const dim = new Set();
  for (let n = 1; n <= 100; n++) {
    for (const h of hints) {
      let contradicts = false;
      if (h.kind === "gt" && n < h.lo) contradicts = true;
      else if (h.kind === "lt" && n > h.hi) contradicts = true;
      else if (h.kind === "between" && (n < h.lo || n > h.hi)) contradicts = true;
      else if (h.kind === "parity" && n % 2 !== h.parity) contradicts = true;
      else if (h.kind === "prime" && !isPrime(n)) contradicts = true;
      else if (h.kind === "notprime" && isPrime(n)) contradicts = true;
      else if (h.kind === "mul5" && n % 5 !== 0) contradicts = true;
      else if (h.kind === "notmul5" && n % 5 === 0) contradicts = true;
      else if (h.kind === "mul10" && n % 10 !== 0) contradicts = true;
      else if (h.kind === "notmul10" && n % 10 === 0) contradicts = true;
      else if (h.kind === "square" && !isSquare(n)) contradicts = true;
      else if (h.kind === "notsquare" && isSquare(n)) contradicts = true;
      if (contradicts) { dim.add(n); break; }
    }
  }
  return dim;
}

// ---- タイマー(UI層・ローカル) ---------------------------------------
let tick = null;
function clearTick() { if (tick) { clearInterval(tick); tick = null; } }

export default {
  id: "guess",
  name: "かずあてゲーム",
  icon: "🔢",
  desc: "1〜100のかくし数字、先に当てたほうの勝ち!",
  rules: `1〜100のひみつの数字を、こうごに予想(ひとり${TRIES}回)。<br>ヒントも${HINTS}回まで使えるよ(答えから逆算した手がかりが出る)。<br>1手番${TURN_SEC}秒。時間切れは自動パス!`,
  rematchable: true,

  initData() {
    return {
      answer: 1 + Math.floor(Math.random() * 100),
      turn: null,          // render側で invitedBy を先攻として補完
      guesses: { a: [], b: [] },   // 各自の回答数字
      hints: [],           // 取得済みヒント [{by, ...hint}]
      log: [],             // ゲームログ [{t, who, kind, n?}]
      winner: null,
      turnStart: Date.now(),
    };
  },

  statsHtml(st) {
    const g = st.byGame?.guess || {};
    return `<span>せんせき ${g.wins || 0}勝${(g.played || 0) - (g.wins || 0) - (g.draws || 0)}敗${g.draws ? `${g.draws}分` : ""}</span>`;
  },

  render(el, m) {
    clearTick();
    const d = m.data;
    const mySeat = seatOf(m, S.uid);
    const turnSeat = d.turn || seatOf(m, m.invitedBy);   // 先攻=さそった人
    const myTurn = turnSeat === mySeat;
    const pu = partnerUid();
    const meP = personOf(S.uid), paP = personOf(pu);

    const myGuesses = d.guesses[mySeat] || [];
    const paGuesses = d.guesses[otherSeat(mySeat)] || [];
    const myLeft = TRIES - myGuesses.length;
    const myHintsUsed = (d.hints || []).filter((h) => h.by === mySeat).length;
    const myHintLeft = HINTS - myHintsUsed;

    const guessed = new Set([...myGuesses, ...paGuesses].map((g) => g.n));
    const dim = dimSet(d.hints || []);

    el.innerHTML = `
      <div class="gs-status">
        <span class="gs-badge" style="--pc:${meP.color}">${meP.emoji}
          <small>かいとう</small><b>${TRIES - myLeft} / ${TRIES}</b></span>
        <div class="gs-timer" id="gs-timer"><svg viewBox="0 0 40 40"><circle class="gs-ring-bg" cx="20" cy="20" r="17"/><circle class="gs-ring" cx="20" cy="20" r="17" id="gs-ring"/></svg><span id="gs-sec">${TURN_SEC}</span></div>
        <span class="gs-badge" style="--pc:${meP.color}">💡
          <small>ヒント</small><b>${myHintsUsed} / ${HINTS}</b></span>
      </div>

      <p class="gs-turn ${myTurn ? "mine" : ""}">${myTurn ? "あなたの番! 数字をえらぶか、ヒントをもらおう" : `${esc(paP.name)}が かんがえています…`}</p>

      <div class="gs-hints">
        ${(d.hints || []).length ? d.hints.map((h) => {
          const p = h.by === mySeat ? meP : paP;
          return `<span class="gs-hchip">💡 ${esc(h.text)}<i style="background:${p.color}"></i></span>`;
        }).join("") : `<span class="dim small">ヒントはまだないよ</span>`}
      </div>

      <div class="gs-grid">
        ${Array.from({ length: 100 }, (_, i) => i + 1).map((n) => {
          const done = guessed.has(n);
          const faded = dim.has(n) && !done;
          return `<button class="gs-cell ${done ? "used" : ""} ${faded ? "faded" : ""}"
            data-n="${n}" ${done || !myTurn ? "disabled" : ""}>${n}</button>`;
        }).join("")}
      </div>

      <div class="gs-actions">
        <button class="btn btn-ghost gs-hint-btn" ${!myTurn || myHintLeft <= 0 ? "disabled" : ""}>
          💡 ヒントをもらう(のこり${myHintLeft})</button>
      </div>

      <div class="gs-history">
        <div class="gs-col"><b style="color:${meP.color}">${meP.emoji}じぶん</b>
          ${myGuesses.map((g) => `<span>${g.n} ${g.hit ? "🎯" : g.hint === "up" ? "⬆" : "⬇"}</span>`).join("") || "<span class='dim'>-</span>"}</div>
        <div class="gs-col"><b style="color:${paP.color}">${paP.emoji}あいて</b>
          ${paGuesses.map((g) => `<span>${g.n} ${g.hit ? "🎯" : g.hint === "up" ? "⬆" : "⬇"}</span>`).join("") || "<span class='dim'>-</span>"}</div>
      </div>

      <div class="gs-logbox">
        ${(d.log || []).slice(-6).map((l) => `<p class="gs-logline">${logLine(l, m)}</p>`).join("")}
      </div>
    `;

    // ---- 数字タップ → 確認ダイアログ → 回答 ----
    el.querySelectorAll(".gs-cell:not([disabled])").forEach((b) => {
      b.onclick = () => {
        const n = +b.dataset.n;
        modal({
          title: "かくにん",
          body: `<p class="center" style="font-size:18px">${n} で回答しますか？</p>`,
          actions: [
            { label: "キャンセル", cls: "btn-ghost" },
            { label: "回答する", cls: "btn-primary", onClick: (c) => { c(); this.guess(n); } },
          ],
        });
      };
    });

    // ---- ヒント ----
    const hb = el.querySelector(".gs-hint-btn");
    if (hb && myTurn && myHintLeft > 0) hb.onclick = () => this.useHint();

    // ---- タイマー(自分の番のときだけ動かす) ----
    if (myTurn && !d.winner) this.startTimer(el, d);
  },

  startTimer(el, d) {
    const ring = el.querySelector("#gs-ring");
    const secEl = el.querySelector("#gs-sec");
    const timerBox = el.querySelector("#gs-timer");
    const CIRC = 2 * Math.PI * 17;
    if (ring) { ring.style.strokeDasharray = CIRC; }
    const update = () => {
      const left = Math.max(0, TURN_SEC - Math.floor((Date.now() - (d.turnStart || Date.now())) / 1000));
      if (secEl) secEl.textContent = left;
      if (ring) ring.style.strokeDashoffset = CIRC * (1 - left / TURN_SEC);
      if (timerBox) timerBox.classList.toggle("danger", left <= 10);
      if (left <= 0) { clearTick(); this.timeout(); }
    };
    update();
    tick = setInterval(update, 250);
  },

  guess(n) {
    clearTick();
    return txMatch((m) => {
      if (m.status !== "active" || m.gameId !== this.id) return false;
      const d = m.data;
      const seat = seatOf(m, S.uid);
      const turnSeat = d.turn || seatOf(m, m.invitedBy);
      if (turnSeat !== seat || (d.guesses[seat] || []).length >= TRIES) return false;
      if ([...d.guesses.a, ...d.guesses.b].some((g) => g.n === n)) return false; // 既出は不可

      const hit = n === d.answer;
      const rec = hit ? { n, hit: true } : { n, hint: n < d.answer ? "up" : "down" };
      d.guesses[seat] = [...(d.guesses[seat] || []), rec];
      d.log = [...(d.log || []), { t: Date.now(), who: seat, kind: "guess", n, hit }];

      if (hit) { d.winner = seat; m.status = "result"; }
      else {
        const total = d.guesses.a.length + d.guesses.b.length;
        if (total >= TRIES * 2) { d.winner = null; m.status = "result"; }
        else { d.turn = otherSeat(seat); d.turnStart = Date.now(); }
      }
      m.updatedAt = Date.now();
      return m;
    });
  },

  useHint() {
    return txMatch((m) => {
      if (m.status !== "active" || m.gameId !== this.id) return false;
      const d = m.data;
      const seat = seatOf(m, S.uid);
      const turnSeat = d.turn || seatOf(m, m.invitedBy);
      if (turnSeat !== seat) return false;
      if ((d.hints || []).filter((h) => h.by === seat).length >= HINTS) return false;
      const used = (d.hints || []).map((h) => h.kind);
      const h = makeHint(d.answer, used);
      d.hints = [...(d.hints || []), { by: seat, ...h }];
      d.log = [...(d.log || []), { t: Date.now(), who: seat, kind: "hint" }];
      // ヒントは手番を消費しない(回答とは別枠)。時間はリセットして考え直せる
      d.turnStart = Date.now();
      m.updatedAt = Date.now();
      return m;
    });
  },

  timeout() {
    return txMatch((m) => {
      if (m.status !== "active" || m.gameId !== this.id) return false;
      const d = m.data;
      const seat = seatOf(m, S.uid);
      const turnSeat = d.turn || seatOf(m, m.invitedBy);
      if (turnSeat !== seat) return false;                 // 自分の番のときだけ
      if (Date.now() - (d.turnStart || 0) < TURN_SEC * 1000 - 500) return false; // 誤発火防止
      // 回答1回を消費(失敗として記録)して自動パス
      d.guesses[seat] = [...(d.guesses[seat] || []), { n: null, timeout: true }];
      d.log = [...(d.log || []), { t: Date.now(), who: seat, kind: "timeout" }];
      const total = d.guesses.a.length + d.guesses.b.length;
      if (total >= TRIES * 2) { d.winner = null; m.status = "result"; }
      else { d.turn = otherSeat(seat); d.turnStart = Date.now(); }
      m.updatedAt = Date.now();
      return m;
    });
  },

  renderResult(m) {
    clearTick();
    const d = m.data;
    const w = d.winner ? personOf(m.players[d.winner]) : null;
    return `
      <div class="result-icon">${w ? "🎯" : "🤝"}</div>
      <h2>${w ? `${esc(w.name)}が 当てた!` : "ふたりとも おしかった!"}</h2>
      <div class="result-stars">こたえは ${d.answer}</div>
      <p>${w ? "みごと正解!" : "ひきわけ! もう一度どうぞ"}</p>
      <p class="result-reward">🪙 かち+40 / まけ+15 / ひきわけ+20ずつ<br>🍚+1ずつ / ペットに ✨+20</p>`;
  },

  summary(m) {
    const d = m.data;
    return { kind: "vs", answer: d.answer, winner: d.winner ? m.players[d.winner] : null,
      guesses: d.guesses };
  },

  async rewards(m, isHost) {
    const d = m.data;
    const seat = seatOf(m, S.uid);
    const res = d.winner == null ? "draw" : d.winner === seat ? "win" : "lose";
    if (!isHost) {
      await addCoins(res === "win" ? 40 : res === "draw" ? 20 : 15);
      await addFood(1);
      await recordResult("guess", res);
      logH("game", { gameId: "guess", answer: d.answer, result: res });
      if (res === "win") { confetti(30); SE("win"); }
    } else {
      await gainExp(20, "かずあて");
      await addPersonality("yuukan", 2);
    }
  },
};

// ---- ログ1行の文言(UI層) --------------------------------------------
function logLine(l, m) {
  const who = personOf(m.players[l.who]);
  const name = `<b style="color:${who.color}">${esc(who.name)}</b>`;
  if (l.kind === "guess") return l.hit ? `${name} が ${l.n} で正解! 🎯` : `${name} が ${l.n} で回答`;
  if (l.kind === "hint") return `${name} がヒントを使った 💡`;
  if (l.kind === "timeout") return `⏰ ${name} は時間切れのため回答をスキップしました`;
  return "";
}
