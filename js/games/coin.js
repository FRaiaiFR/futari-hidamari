// =====================================================================
// 裏表心理コイン(対戦ゲーム)
// にぎる人がコインの表裏を決め、あてる人が予想。役割は毎ラウンド交代。
// 全5ラウンド(引き分けなし)。
// =====================================================================
import { txMatch } from "../core/match.js";
import { S, personOf, partnerUid } from "../core/state.js";
import { esc } from "../core/ui.js";
import { SE } from "../core/sound.js";
import { addCoins, bumpStat, recordResult } from "../core/economy.js";
import { gainExp, addPersonality } from "../pet/pet.js";
import { logH } from "../core/history.js";

const ROUNDS = 5;
const FACE = { omote: "🌞 おもて", ura: "🌚 うら" };

export default {
  id: "coin",
  name: "裏表心理コイン",
  icon: "🪙",
  desc: "あいての心を読めるか、しんけんしょうぶ!",
  rules: `「にぎる人」がコインの表裏をきめて、<br>「あてる人」がそれを予想。<br>あたれば あてる人、はずれれば にぎる人 の得点。<br>役割は交代しながら全${ROUNDS}回戦!`,

  initData() {
    return { round: 1, phase: "choose", picks: {}, scores: {}, log: [] };
  },

  /** このラウンドで「にぎる人」のuid(奇数R=さそった人) */
  setterOf(m, round) {
    return round % 2 === 1 ? m.players.a : m.players.b;
  },

  render(el, m) {
    const d = m.data;
    const setter = this.setterOf(m, d.round);
    const iAmSetter = setter === S.uid;
    const myPick = d.picks?.[S.uid];
    const pu = partnerUid();
    const scoreBar = this.scoreBar(m);

    if (d.phase === "choose") {
      if (myPick) {
        el.innerHTML = `${scoreBar}
          <div class="coin-role">${iAmSetter ? "🫰 あなたが にぎる番" : "🔮 あなたが あてる番"}</div>
          <p class="center">えらんだ: <b>${FACE[myPick]}</b></p>
          <p class="center waiting-dots">あいてを まっています</p>`;
        return;
      }
      el.innerHTML = `${scoreBar}
        <div class="coin-role">${iAmSetter
          ? "🫰 あなたが <b>にぎる番</b><br><small>あいてに読まれない方をえらぼう</small>"
          : "🔮 あなたが <b>あてる番</b><br><small>あいてがにぎった面はどっち?</small>"}</div>
        <div class="coin-btns">
          <button class="coin-btn" data-v="omote">🌞<span>おもて</span></button>
          <button class="coin-btn" data-v="ura">🌚<span>うら</span></button>
        </div>`;
      el.querySelectorAll(".coin-btn").forEach((b) => {
        b.onclick = () => this.pick(b.dataset.v);
      });
      return;
    }

    // reveal
    const last = d.log[d.log.length - 1];
    const hit = last.hit;
    const winnerUid = hit ? last.guesser : last.setter;
    const w = personOf(winnerUid);
    el.innerHTML = `${scoreBar}
      <div class="coin-reveal">
        <div class="coin-face big">${last.set === "omote" ? "🌞" : "🌚"}</div>
        <p>にぎられていたのは <b>${FACE[last.set]}</b><br>よそうは <b>${FACE[last.guess]}</b></p>
        <p class="coin-judge" style="color:${w.color}">${hit ? "🎯 よみ的中!" : "😏 だましきった!"} <b>${esc(w.name)}</b> のポイント!</p>
      </div>
      <button class="btn btn-primary btn-big coin-next">${d.round >= ROUNDS ? "けっかを見る" : "つぎのしょうぶへ"}</button>`;
    el.querySelector(".coin-next").onclick = () => this.next();
  },

  pick(v) {
    return txMatch((m) => {
      if (m.status !== "active" || m.gameId !== this.id) return false;
      const d = m.data;
      if (d.phase !== "choose" || d.picks?.[S.uid]) return false;
      d.picks = { ...(d.picks || {}), [S.uid]: v };
      const uids = [m.players.a, m.players.b];
      if (uids.every((u) => d.picks[u])) {
        const setter = this.setterOf(m, d.round);
        const guesser = uids.find((u) => u !== setter);
        const hit = d.picks[setter] === d.picks[guesser];
        const winner = hit ? guesser : setter;
        d.scores = { ...(d.scores || {}) };
        d.scores[winner] = (d.scores[winner] || 0) + 1;
        d.log = [...(d.log || []), { round: d.round, setter, guesser, set: d.picks[setter], guess: d.picks[guesser], hit }];
        d.phase = "reveal";
      }
      m.updatedAt = Date.now();
      return m;
    });
  },

  next() {
    return txMatch((m) => {
      if (m.status !== "active" || m.gameId !== this.id || m.data.phase !== "reveal") return false;
      const d = m.data;
      if (d.round >= ROUNDS) {
        m.status = "result";
      } else {
        d.round += 1;
        d.phase = "choose";
        d.picks = {};
      }
      m.updatedAt = Date.now();
      return m;
    });
  },

  scoreBar(m) {
    const a = personOf(m.players.a), b = personOf(m.players.b);
    const sa = m.data.scores?.[m.players.a] || 0, sb = m.data.scores?.[m.players.b] || 0;
    return `<div class="coin-score">
      <span style="color:${a.color}">${a.emoji} ${esc(a.name)} <b>${sa}</b></span>
      <span class="cs-round">R${m.data.round}/${ROUNDS}</span>
      <span style="color:${b.color}"><b>${sb}</b> ${esc(b.name)} ${b.emoji}</span>
    </div>`;
  },

  winnerUid(m) {
    const sa = m.data.scores?.[m.players.a] || 0, sb = m.data.scores?.[m.players.b] || 0;
    return sa > sb ? m.players.a : m.players.b;
  },

  renderResult(m) {
    const w = personOf(this.winnerUid(m));
    const sa = m.data.scores?.[m.players.a] || 0, sb = m.data.scores?.[m.players.b] || 0;
    return `
      <div class="result-icon">🪙</div>
      <h2 style="color:${w.color}">${w.emoji} ${esc(w.name)} のかち!</h2>
      <div class="result-stars">${Math.max(sa, sb)} - ${Math.min(sa, sb)}</div>
      <p>かった人 🪙+40 / まけた人 🪙+15<br>ペットに ✨+25</p>`;
  },

  summary(m) {
    const d = m.data;
    return { kind: "vs", scores: d.scores || {}, log: (d.log || []).slice(0, 10) };
  },
  async rewards(m, isHost) {
    const winner = this.winnerUid(m);
    if (!isHost) {
      const iWon = winner === S.uid;
      await addCoins(iWon ? 40 : 15);
      await recordResult("coin", iWon ? "win" : "lose");
      if (iWon) SE("win");
      // 「読まれ率」: 自分がにぎった回のうち、あてられた回数
      const myset = (m.data.log || []).filter((l) => l.setter === S.uid);
      await bumpStat("coinSetRounds", myset.length);
      await bumpStat("coinSetRead", myset.filter((l) => l.hit).length);
      logH("game", { gameId: "coin", win: iWon });
    } else {
      await gainExp(25, "コイン対決");
      await addPersonality("yuukan", 2);
    }
  },
};
