// =====================================================================
// おもいでクイズ(対戦ゲーム)
// ふたりの記録(通じた言葉・回答・数字)から自動で4択を出題。全5問。
// 2人同時に回答し、正解数で勝負(協力寄り: 合計正解でペットもよろこぶ)。
// =====================================================================
import { txMatch } from "../core/match.js";
import { S, personOf, partnerUid } from "../core/state.js";
import { esc, confetti } from "../core/ui.js";
import { addCoins, addFood, recordResult } from "../core/economy.js";
import { gainExp, addPersonality } from "../pet/pet.js";
import { logH } from "../core/history.js";
import { SE } from "../core/sound.js";
import { buildQuizPool } from "../core/memory.js";

const ROUNDS = 5;

export default {
  id: "omoide",
  name: "おもいでクイズ",
  icon: "📸",
  desc: "ふたりの記録から出題! どっちがおぼえてる?",
  rules: `これまでの「ふたりの記録」から自動で4択クイズ。<br>全${ROUNDS}問、同時に答えて正解数でしょうぶ。<br>あそぶほど問題がふえていくよ`,
  rematchable: true,

  initData() {
    let pool = buildQuizPool();
    if (pool.length < ROUNDS) {
      // 記録がまだ少ないときの汎用問題(ふたりに関する軽い問い)
      pool = pool.concat([
        { q: "ペットのなまえは?", opts: [S.pet?.name || "もこ", "ぽこ", "みる", "はな"], ans: S.pet?.name || "もこ" },
      ]);
    }
    const qs = [];
    const p = [...pool];
    for (let i = 0; i < ROUNDS && p.length; i++) qs.push(p.splice(Math.floor(Math.random() * p.length), 1)[0]);
    return { round: 1, qs, answers: {}, scores: {}, phase: "q" };
  },

  statsHtml(st) {
    const g = st.byGame?.omoide || {};
    return `<span>せんせき ${g.wins || 0}勝${g.draws || 0}分${(g.played || 0) - (g.wins || 0) - (g.draws || 0)}敗</span>`;
  },

  render(el, m) {
    const d = m.data;
    const q = d.qs[d.round - 1];
    if (!q) { el.innerHTML = `<p class="dim center">問題を つくれなかった…記録がふえたら またあそぼう</p>`; return; }
    const mine = d.answers?.[S.uid];
    const pu = partnerUid();
    const meP = personOf(S.uid), paP = personOf(pu);
    const sc = (uid) => d.scores?.[uid] || 0;

    const head = `<div class="coin-score">
      <span style="color:${meP.color}">${meP.emoji} <b>${sc(S.uid)}</b></span>
      <span class="cs-round">Q${d.round}/${d.qs.length}</span>
      <span style="color:${paP.color}"><b>${sc(pu)}</b> ${paP.emoji}</span></div>`;

    if (d.phase === "q") {
      if (mine != null) {
        el.innerHTML = `${head}<p class="wm-topic small">${esc(q.q)}</p>
          <p class="center">あなた: <b>${esc(mine)}</b></p>
          <p class="center waiting-dots">あいてを まっています</p>`;
        return;
      }
      el.innerHTML = `${head}<p class="wm-topic small">${esc(q.q)}</p>
        <div class="oq-opts">${q.opts.map((o) => `<button class="oq-opt" data-v="${esc(o)}">${esc(o)}</button>`).join("")}</div>`;
      el.querySelectorAll(".oq-opt").forEach((b) => { b.onclick = () => this.answer(b.dataset.v); });
      return;
    }
    // reveal
    const myOk = d.answers[S.uid] === q.ans, paOk = d.answers[pu] === q.ans;
    el.innerHTML = `${head}<p class="wm-topic small">${esc(q.q)}</p>
      <p class="center result-stars">こたえ: ${esc(q.ans)}</p>
      <p class="center">${meP.emoji}${myOk ? "⭕" : "❌"}  ${paP.emoji}${paOk ? "⭕" : "❌"}</p>
      <button class="btn btn-primary btn-big oq-next">${d.round >= d.qs.length ? "けっかを見る" : "つぎの問題へ"}</button>`;
    el.querySelector(".oq-next").onclick = () => this.next();
  },

  answer(v) {
    return txMatch((m) => {
      if (m.status !== "active" || m.gameId !== this.id) return false;
      const d = m.data;
      if (d.phase !== "q" || d.answers?.[S.uid] != null) return false;
      d.answers = { ...(d.answers || {}), [S.uid]: v };
      const uids = [m.players.a, m.players.b];
      if (uids.every((u) => d.answers[u] != null)) {
        const q = d.qs[d.round - 1];
        d.scores = { ...(d.scores || {}) };
        for (const u of uids) if (d.answers[u] === q.ans) d.scores[u] = (d.scores[u] || 0) + 1;
        d.phase = "r";
      }
      m.updatedAt = Date.now();
      return m;
    });
  },

  next() {
    return txMatch((m) => {
      if (m.status !== "active" || m.gameId !== this.id || m.data.phase !== "r") return false;
      const d = m.data;
      if (d.round >= d.qs.length) m.status = "result";
      else { d.round += 1; d.phase = "q"; d.answers = {}; }
      m.updatedAt = Date.now();
      return m;
    });
  },

  renderResult(m) {
    const d = m.data;
    const pu = partnerUid();
    const my = d.scores?.[S.uid] || 0, pa = d.scores?.[pu] || 0;
    const msg = my === pa ? "おなじだけ おぼえてた!" : my > pa ? `${esc(personOf(S.uid).name)}のかち!` : `${esc(personOf(pu).name)}のかち!`;
    return `<div class="result-icon">📸</div><h2>${msg}</h2>
      <div class="result-stars">${my} - ${pa}</div>
      <p>ふたりの おもいで、だいじにしてるね</p>
      <p class="result-reward">🪙 かち+40 / まけ+20 / ひきわけ+30ずつ / 🍚+1ずつ / ペットに ✨+25</p>`;
  },

  summary(m) {
    return { kind: "vs", scores: m.data.scores || {} };
  },

  async rewards(m, isHost) {
    const pu = partnerUid();
    const my = m.data.scores?.[S.uid] || 0, pa = m.data.scores?.[pu] || 0;
    const res = my === pa ? "draw" : my > pa ? "win" : "lose";
    if (!isHost) {
      await addCoins(res === "win" ? 40 : res === "draw" ? 30 : 20);
      await addFood(1);
      await recordResult("omoide", res);
      logH("game", { gameId: "omoide", result: res });
      if (res === "win") { confetti(30); SE("win"); }
    } else {
      await gainExp(25, "おもいでクイズ");
      await addPersonality("monoshiri", 2);
    }
  },
};
