// =====================================================================
// こころあて(相手の答え当て・対戦ゲーム)
// 質問に「自分の答え」を書き、同時に「相手はこう答えるはず」も予想。
// 相手の実際の答えと予想が(読みで)一致したら得点。全4問。
// =====================================================================
import { txMatch } from "../core/match.js";
import { S, personOf, partnerUid } from "../core/state.js";
import { esc, confetti } from "../core/ui.js";
import { addCoins, addFood, recordResult } from "../core/economy.js";
import { gainExp, addPersonality } from "../pet/pet.js";
import { logH } from "../core/history.js";
import { SE } from "../core/sound.js";
import { toYomi } from "../data/yomi.js";
import { learnWord } from "../core/memory.js";
import { QUESTIONS } from "../data/questions.js";

const ROUNDS = 4;

export default {
  id: "kokoro",
  name: "こころあて",
  icon: "🔮",
  desc: "あいての答えを ぴたりと当てられる?",
  rules: `質問に「じぶんの答え」と「あいての答えの予想」を両方かくよ。<br>予想が あいての本当の答えと合っていたら得点!<br>全${ROUNDS}問。ふたりの理解度がためされる…`,
  rematchable: true,

  initData() {
    const pool = QUESTIONS.filter((q) => q.level <= 2);
    const qs = [];
    const p = [...pool];
    for (let i = 0; i < ROUNDS; i++) qs.push(p.splice(Math.floor(Math.random() * p.length), 1)[0].text);
    return { round: 1, qs, subs: {}, scores: {}, phase: "q" };
  },

  statsHtml(st) {
    const g = st.byGame?.kokoro || {};
    return `<span>せんせき ${g.wins || 0}勝${g.draws || 0}分${(g.played || 0) - (g.wins || 0) - (g.draws || 0)}敗</span>`;
  },

  render(el, m) {
    const d = m.data;
    const q = d.qs[d.round - 1];
    const mine = d.subs?.[S.uid];
    const pu = partnerUid();
    const meP = personOf(S.uid), paP = personOf(pu);
    const sc = (uid) => d.scores?.[uid] || 0;
    const head = `<div class="coin-score">
      <span style="color:${meP.color}">${meP.emoji} <b>${sc(S.uid)}</b></span>
      <span class="cs-round">Q${d.round}/${ROUNDS}</span>
      <span style="color:${paP.color}"><b>${sc(pu)}</b> ${paP.emoji}</span></div>`;

    if (d.phase === "q") {
      if (mine) {
        el.innerHTML = `${head}<p class="wm-topic small">${esc(q)}</p>
          <p class="center">じぶん: <b>${esc(mine.self)}</b> / よそう: <b>${esc(mine.pred)}</b></p>
          <p class="center waiting-dots">あいてを まっています</p>`;
        return;
      }
      el.innerHTML = `${head}<p class="wm-topic small">${esc(q)}</p>
        <label class="ko-label">あなたの答え</label>
        <input class="txt-input" id="ko-self" maxlength="20" placeholder="ほんとうの気もち">
        <label class="ko-label">${esc(paP.name)}は こう答えるはず…</label>
        <input class="txt-input" id="ko-pred" maxlength="20" placeholder="よそうしてみて">
        <button class="btn btn-primary btn-big" id="ko-go" style="margin-top:10px">これでいく!</button>`;
      el.querySelector("#ko-go").onclick = () => {
        const self = el.querySelector("#ko-self").value.trim();
        const pred = el.querySelector("#ko-pred").value.trim();
        if (!self || !pred) return;
        this.submit(self, pred);
      };
      return;
    }
    // reveal
    const a = d.subs[S.uid], b = d.subs[pu];
    const myHit = toYomi(a.pred) !== "" && toYomi(a.pred) === toYomi(b.self);
    const paHit = toYomi(b.pred) !== "" && toYomi(b.pred) === toYomi(a.self);
    el.innerHTML = `${head}<p class="wm-topic small">${esc(q)}</p>
      <div class="ko-rev">
        <p>${meP.emoji} 答え「${esc(a.self)}」/ 予想「${esc(a.pred)}」${myHit ? "🎯" : ""}</p>
        <p>${paP.emoji} 答え「${esc(b.self)}」/ 予想「${esc(b.pred)}」${paHit ? "🎯" : ""}</p>
      </div>
      <p class="wm-judge">${myHit && paHit ? "おたがい まるわかり!💞" : myHit ? "あなたの読みが的中!" : paHit ? `${esc(paP.name)}に 読まれてた!` : "ふたりとも まだまだ ミステリアス"}</p>
      <button class="btn btn-primary btn-big ko-next">${d.round >= ROUNDS ? "けっかを見る" : "つぎの質問へ"}</button>`;
    el.querySelector(".ko-next").onclick = () => this.next();
  },

  submit(self, pred) {
    learnWord(self);
    return txMatch((m) => {
      if (m.status !== "active" || m.gameId !== this.id) return false;
      const d = m.data;
      if (d.phase !== "q" || d.subs?.[S.uid]) return false;
      d.subs = { ...(d.subs || {}), [S.uid]: { self, pred } };
      const uids = [m.players.a, m.players.b];
      if (uids.every((u) => d.subs[u])) {
        d.scores = { ...(d.scores || {}) };
        const [ua, ub] = uids;
        const A = d.subs[ua], B = d.subs[ub];
        if (toYomi(A.pred) !== "" && toYomi(A.pred) === toYomi(B.self)) d.scores[ua] = (d.scores[ua] || 0) + 1;
        if (toYomi(B.pred) !== "" && toYomi(B.pred) === toYomi(A.self)) d.scores[ub] = (d.scores[ub] || 0) + 1;
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
      if (d.round >= ROUNDS) m.status = "result";
      else { d.round += 1; d.phase = "q"; d.subs = {}; }
      m.updatedAt = Date.now();
      return m;
    });
  },

  renderResult(m) {
    const pu = partnerUid();
    const my = m.data.scores?.[S.uid] || 0, pa = m.data.scores?.[pu] || 0;
    const msg = my === pa ? "りかいど 互角!" : my > pa ? `${esc(personOf(S.uid).name)}のほうが わかってる!` : `${esc(personOf(pu).name)}のほうが わかってる!`;
    return `<div class="result-icon">🔮</div><h2>${msg}</h2>
      <div class="result-stars">${my} - ${pa}</div>
      <p>答えあわせした ぶんだけ、ふたりは近づく</p>
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
      await recordResult("kokoro", res);
      logH("game", { gameId: "kokoro", result: res });
      if (res === "win") { confetti(30); SE("win"); }
    } else {
      await gainExp(25, "こころあて");
      await addPersonality("nakayoshi", 2);
    }
  },
};
