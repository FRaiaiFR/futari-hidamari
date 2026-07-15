// =====================================================================
// 裏表心理コイン(対戦ゲーム) — 順次進行版
// にぎる人が先に面を選び、あてる人はそれまで待機(ロック)。
// にぎる人が選び終わってから あてる人が予想。役割は毎ラウンド交代。
// 難易度=選択肢の数(2〜5択)。全5ラウンド(引き分けなし)。
// =====================================================================
import { txMatch } from "../core/match.js";
import { S, personOf, partnerUid } from "../core/state.js";
import { esc } from "../core/ui.js";
import { SE } from "../core/sound.js";
import { addCoins, bumpStat, recordResult } from "../core/economy.js";
import { gainExp, addPersonality } from "../pet/pet.js";
import { logH } from "../core/history.js";

const ROUNDS = 5;

// 選択肢のマスター(最大5択。難易度で先頭からn個を使う)
const OPTIONS = [
  { id: "omote", icon: "🌞", label: "おもて" },
  { id: "ura",   icon: "🌚", label: "うら" },
  { id: "hoshi", icon: "⭐", label: "ほし" },
  { id: "tuki",  icon: "🌙", label: "つき" },
  { id: "hana",  icon: "🌸", label: "はな" },
];
const optOf = (id) => OPTIONS.find((o) => o.id === id) || { icon: "?", label: id };
const faceLabel = (id) => `${optOf(id).icon} ${optOf(id).label}`;

export default {
  id: "coin",
  name: "裏表心理コイン",
  icon: "🪙",
  desc: "あいての心を読めるか、しんけんしょうぶ!",
  rules: `「にぎる人」がまず面をきめて、そのあと「あてる人」が予想。<br>あたれば あてる人、はずれれば にぎる人 の得点。<br>役割は交代しながら全${ROUNDS}回戦!`,
  rematchable: true,

  initData() {
    // phase: "mode"(難易度選択) → "set"(にぎる) → "guess"(あてる) → "reveal"
    return { phase: "mode", opts: 2, round: 1, setPick: null, guessPick: null, scores: {}, log: [] };
  },

  setterOf(m, round) {
    return round % 2 === 1 ? m.players.a : m.players.b;
  },

  render(el, m) {
    const d = m.data;
    const isHost = m.invitedBy === S.uid;
    const scoreBar = this.scoreBar(m);

    // ---- 難易度選択(ホストが選ぶ) ----
    if (d.phase === "mode") {
      el.innerHTML = isHost ? `
        <p class="center" style="margin:14px 0 6px">むずかしさ(えらぶ数)を きめてね</p>
        <div class="mode-btns coin-modes">
          ${[2, 3, 4, 5].map((n) => `
            <button class="mode-btn" data-opts="${n}"><b>${n}択</b><span>${OPTIONS.slice(0, n).map((o) => o.icon).join("")}</span></button>`).join("")}
        </div>`
        : `<p class="center waiting-dots" style="margin-top:40px">あいてが むずかしさを えらんでいます</p>`;
      el.querySelectorAll("[data-opts]").forEach((b) => {
        b.onclick = () => txMatch((mm) => {
          if (mm.status !== "active" || mm.data.phase !== "mode") return false;
          mm.data.opts = +b.dataset.opts;
          mm.data.phase = "set";
          mm.updatedAt = Date.now();
          return mm;
        });
      });
      return;
    }

    const setter = this.setterOf(m, d.round);
    const iAmSetter = setter === S.uid;
    const opts = OPTIONS.slice(0, d.opts || 2);

    // ---- にぎるフェーズ ----
    if (d.phase === "set") {
      if (iAmSetter) {
        el.innerHTML = `${scoreBar}
          <div class="coin-role">🫰 あなたが <b>にぎる番</b><br><small>あいてに読まれない面をえらぼう</small></div>
          ${this.optButtons(opts)}`;
        el.querySelectorAll(".coin-btn").forEach((b) => { b.onclick = () => this.setPick(b.dataset.v); });
      } else {
        // あてる人は待機(ロック)
        el.innerHTML = `${scoreBar}
          <div class="coin-role">🔮 あなたが <b>あてる番</b></div>
          <div class="coin-wait"><div class="coin-lock">🔒</div>
            <p class="waiting-dots">相手が選択中です</p>
            <p class="dim small">えらび終わるまで まってね</p></div>`;
      }
      return;
    }

    // ---- あてるフェーズ ----
    if (d.phase === "guess") {
      if (iAmSetter) {
        el.innerHTML = `${scoreBar}
          <div class="coin-role">🫰 あなたが にぎった: <b>${faceLabel(d.setPick)}</b></div>
          <div class="coin-wait"><div class="coin-lock">👀</div>
            <p class="waiting-dots">相手が予想中です</p></div>`;
      } else {
        el.innerHTML = `${scoreBar}
          <div class="coin-role">🔮 あなたが <b>あてる番</b><br><small>あいてがにぎった面はどれ?</small></div>
          ${this.optButtons(opts)}`;
        el.querySelectorAll(".coin-btn").forEach((b) => { b.onclick = () => this.guessPick(b.dataset.v); });
      }
      return;
    }

    // ---- リザルト(reveal) ----
    const last = d.log[d.log.length - 1];
    const hit = last.hit;
    const w = personOf(hit ? last.guesser : last.setter);
    el.innerHTML = `${scoreBar}
      <div class="coin-reveal">
        <div class="coin-face big">${optOf(last.set).icon}</div>
        <p>にぎられていたのは <b>${faceLabel(last.set)}</b><br>よそうは <b>${faceLabel(last.guess)}</b></p>
        <p class="coin-judge" style="color:${w.color}">${hit ? "🎯 よみ的中!" : "😏 だましきった!"} <b>${esc(w.name)}</b> のポイント!</p>
      </div>
      <button class="btn btn-primary btn-big coin-next">${d.round >= ROUNDS ? "けっかを見る" : "つぎのしょうぶへ"}</button>`;
    el.querySelector(".coin-next").onclick = () => this.next();
  },

  optButtons(opts) {
    return `<div class="coin-btns opts-${opts.length}">
      ${opts.map((o) => `<button class="coin-btn" data-v="${o.id}">${o.icon}<span>${o.label}</span></button>`).join("")}
    </div>`;
  },

  setPick(v) {
    return txMatch((m) => {
      if (m.status !== "active" || m.gameId !== this.id) return false;
      const d = m.data;
      if (d.phase !== "set" || this.setterOf(m, d.round) !== S.uid) return false;
      d.setPick = v;
      d.phase = "guess";       // にぎり完了 → あてる人のロック解除
      m.updatedAt = Date.now();
      return m;
    });
  },

  guessPick(v) {
    return txMatch((m) => {
      if (m.status !== "active" || m.gameId !== this.id) return false;
      const d = m.data;
      const setter = this.setterOf(m, d.round);
      if (d.phase !== "guess" || setter === S.uid) return false;   // あてる人だけ
      d.guessPick = v;
      const guesser = S.uid;
      const hit = d.setPick === v;
      const winner = hit ? guesser : setter;
      d.scores = { ...(d.scores || {}) };
      d.scores[winner] = (d.scores[winner] || 0) + 1;
      d.log = [...(d.log || []), { round: d.round, setter, guesser, set: d.setPick, guess: v, hit }];
      d.phase = "reveal";
      m.updatedAt = Date.now();
      return m;
    });
  },

  next() {
    return txMatch((m) => {
      if (m.status !== "active" || m.gameId !== this.id || m.data.phase !== "reveal") return false;
      const d = m.data;
      if (d.round >= ROUNDS) { m.status = "result"; }
      else { d.round += 1; d.phase = "set"; d.setPick = null; d.guessPick = null; }
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
    return sa >= sb ? m.players.a : m.players.b;
  },

  renderResult(m) {
    const sa = m.data.scores?.[m.players.a] || 0, sb = m.data.scores?.[m.players.b] || 0;
    const w = personOf(this.winnerUid(m));
    return `
      <div class="result-icon">🪙</div>
      <h2 style="color:${w.color}">${w.emoji} ${esc(w.name)} のかち!</h2>
      <div class="result-stars">${Math.max(sa, sb)} - ${Math.min(sa, sb)}</div>
      <p>かった人 🪙+40 / まけた人 🪙+15<br>ペットに ✨+25</p>`;
  },

  summary(m) {
    const d = m.data;
    return { kind: "vs", scores: d.scores || {}, opts: d.opts, log: (d.log || []).slice(0, 10) };
  },

  async rewards(m, isHost) {
    const winner = this.winnerUid(m);
    if (!isHost) {
      const iWon = winner === S.uid;
      await addCoins(iWon ? 40 : 15);
      await recordResult("coin", iWon ? "win" : "lose");
      if (iWon) SE("win");
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
