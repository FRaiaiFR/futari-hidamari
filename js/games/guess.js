// =====================================================================
// かずあてゲーム(対戦ゲーム)
// 1〜100のかくし数字を、こうごに予想(1人3回まで)。
// 当てたら勝ち。6回で当たらなければ引き分けで答えを公開。
// =====================================================================
import { txMatch } from "../core/match.js";
import { S, personOf, partnerUid } from "../core/state.js";
import { esc, confetti } from "../core/ui.js";
import { addCoins, addFood, recordResult } from "../core/economy.js";
import { gainExp, addPersonality } from "../pet/pet.js";
import { logH } from "../core/history.js";

const TRIES = 3;
const other = (m, uid) => (m.players.a === uid ? m.players.b : m.players.a);
const triesOf = (d, uid) => (d.log || []).filter((g) => g.uid === uid).length;

export default {
  id: "guess",
  name: "かずあてゲーム",
  icon: "🔢",
  desc: "1〜100のかくし数字、先に当てたほうの勝ち!",
  rules: `1〜100のひみつの数字を、こうごに予想(ひとり${TRIES}回まで)。<br>はずれたら「もっと大きい/小さい」のヒントが出るよ。<br>ヒントは2人とも見えるから、あいての予想もヒントに!`,

  initData() {
    return {
      answer: 1 + Math.floor(Math.random() * 100),
      turn: null,        // active化のときは invitedBy が不明なので render 側で補完せず accept 時の players を使う
      log: [],
      winner: null,
    };
  },

  statsHtml(st) {
    const g = st.byGame?.guess || {};
    return `<span>せんせき ${g.wins || 0}勝${(g.played || 0) - (g.wins || 0) - (g.draws || 0)}敗${g.draws ? `${g.draws}分` : ""}</span>`;
  },

  render(el, m) {
    const d = m.data;
    const turn = d.turn || m.invitedBy;   // 先攻=さそった人
    const pu = partnerUid();
    const meP = personOf(S.uid), paP = personOf(pu);
    const myLeft = TRIES - triesOf(d, S.uid);
    const paLeft = TRIES - triesOf(d, pu);
    const myTurn = turn === S.uid;
    const last = (d.log || [])[d.log.length - 1];

    el.innerHTML = `
      <div class="gs-top">
        <span class="mem-chip" style="--pc:${meP.color}">${meP.emoji} のこり${myLeft}回</span>
        <span class="gs-q">❓<br><small>1〜100</small></span>
        <span class="mem-chip" style="--pc:${paP.color}">${paP.emoji} のこり${paLeft}回</span>
      </div>

      ${last ? `<p class="gs-hint">${hintLine(last)}</p>` : `<p class="gs-hint dim">さいしょの予想をどうぞ!</p>`}

      <div class="gs-log">
        ${(d.log || []).map((g) => {
          const p = personOf(g.uid);
          return `<span class="gs-item" style="--pc:${p.color}">${p.emoji} <b>${g.n}</b> ${g.hit ? "🎯" : g.hint === "up" ? "⬆" : "⬇"}</span>`;
        }).join("")}
      </div>

      ${myTurn ? `
        <div class="wm-form">
          <input class="wm-input gs-input" type="number" inputmode="numeric" min="1" max="100" placeholder="1〜100の数字">
          <button class="btn btn-primary btn-big gs-go">これでいく!</button>
        </div>`
        : `<p class="center waiting-dots" style="margin-top:14px">${esc(paP.name)}が かんがえています</p>`}
    `;

    if (myTurn) {
      const input = el.querySelector(".gs-input");
      input.focus();
      const submit = () => {
        const n = Math.floor(Number(input.value));
        if (!Number.isFinite(n) || n < 1 || n > 100) { input.value = ""; input.placeholder = "1〜100で入れてね"; return; }
        this.guess(n);
      };
      el.querySelector(".gs-go").onclick = submit;
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
    }
  },

  guess(n) {
    return txMatch((m) => {
      if (m.status !== "active" || m.gameId !== this.id) return false;
      const d = m.data;
      const turn = d.turn || m.invitedBy;
      if (turn !== S.uid || triesOf(d, S.uid) >= TRIES) return false;
      if ((d.log || []).some((g) => g.n === n)) {
        // 同じ数字の予想はターン消費がもったいないので受け付けない(手元で弾けない同時押し対策)
        return false;
      }
      if (n === d.answer) {
        d.log = [...(d.log || []), { uid: S.uid, n, hit: true }];
        d.winner = S.uid;
        m.status = "result";
      } else {
        d.log = [...(d.log || []), { uid: S.uid, n, hint: n < d.answer ? "up" : "down" }];
        if (d.log.length >= TRIES * 2) {
          d.winner = null;           // 6回つかいきり → 引き分け
          m.status = "result";
        } else {
          d.turn = other(m, S.uid);
        }
      }
      m.updatedAt = Date.now();
      return m;
    });
  },

  renderResult(m) {
    const d = m.data;
    const w = d.winner ? personOf(d.winner) : null;
    return `
      <div class="result-icon">${w ? "🎯" : "🤝"}</div>
      <h2>${w ? `${esc(w.name)}が 当てた!` : "ふたりとも おしかった!"}</h2>
      <div class="result-stars">こたえは ${d.answer}</div>
      <p>${w ? `${d.log.length}回目で正解!` : "ひきわけ! つぎはきっと当たる"}</p>
      <p class="result-reward">🪙 かち+40 / まけ+15 / ひきわけ+20ずつ<br>🍚+1ずつ / ペットに ✨+20</p>`;
  },

  async rewards(m, isHost) {
    const d = m.data;
    const res = d.winner == null ? "draw" : d.winner === S.uid ? "win" : "lose";
    if (!isHost) {
      await addCoins(res === "win" ? 40 : res === "draw" ? 20 : 15);
      await addFood(1);
      await recordResult("guess", res);
      logH("game", { gameId: "guess", answer: d.answer, result: res });
      if (res === "win") confetti(30);
    } else {
      await gainExp(20, "かずあて");
      await addPersonality("yuukan", 2);
    }
  },
};

function hintLine(g) {
  const p = personOf(g.uid);
  if (g.hit) return `🎯 <b>${g.n}</b> … 大正解!`;
  return `<b style="color:${p.color}">${esc(p.name)}</b>の「${g.n}」→ こたえは もっと${g.hint === "up" ? "大きい ⬆" : "小さい ⬇"}`;
}
