// =====================================================================
// UNO(2人対戦)
// 108枚デッキ / スキップ・リバース(2人用=スキップ扱い)・ドロー2・
// ワイルド・ワイルドドロー4 / UNO宣言演出 / 山札切れは捨て札を再シャッフル
// カード表記: 色(R/G/B/Y/W) + 値(0-9, S=スキップ, R=リバース, D=+2, W=ワイルド, F=+4)
// =====================================================================
import { txMatch } from "../core/match.js";
import { S, personOf, partnerUid } from "../core/state.js";
import { esc, modal, confetti } from "../core/ui.js";
import { addCoins, addFood, recordResult } from "../core/economy.js";
import { gainExp, addPersonality } from "../pet/pet.js";
import { logH } from "../core/history.js";

const COLORS = ["R", "G", "B", "Y"];
const COLOR_JP = { R: "あか", G: "みどり", B: "あお", Y: "きいろ" };
const GLYPH = { S: "⊘", R: "⇄", D: "+2", W: "★", F: "+4" };

export function buildDeck() {
  const d = [];
  for (const c of COLORS) {
    d.push(`${c}0`);
    for (let n = 1; n <= 9; n++) d.push(`${c}${n}`, `${c}${n}`);
    d.push(`${c}S`, `${c}S`, `${c}R`, `${c}R`, `${c}D`, `${c}D`);
  }
  for (let i = 0; i < 4; i++) d.push("WW", "WF");
  return d;
}
export function shuffleArr(a) {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
export const playable = (card, top, color) =>
  card[0] === "W" || card[0] === color || card[1] === top[1];

const seatOf = (m, uid) => (m.players.a === uid ? "a" : "b");
const otherSeat = (s) => (s === "a" ? "b" : "a");

/** 山札から1枚(切れたら捨て札を再シャッフル) */
function take(d) {
  if (!d.deck.length) {
    if (d.disc.length <= 1) return null;         // もう配れるカードがない(超レア)
    const top = d.disc[d.disc.length - 1];
    d.deck = shuffleArr(d.disc.slice(0, -1));
    d.disc = [top];
  }
  return d.deck.pop();
}

function cardHTML(card, opts = {}) {
  const c = card[0], v = card[1];
  const glyph = GLYPH[v] || v;
  return `<span class="u-card u-${c} ${opts.cls || ""}" ${opts.attr || ""}>
    <i class="u-oval"></i><b class="u-glyph">${glyph}</b>
    <small class="u-corner tl">${glyph}</small><small class="u-corner br">${glyph}</small>
  </span>`;
}

export default {
  id: "uno",
  name: "UNO",
  icon: "🌈",
  desc: "さきに手札を出しきったほうの勝ち!",
  rules: "同じ色か同じ数字・記号のカードを出せるよ。<br>⊘=スキップ ⇄=リバース(2人ではスキップと同じ) +2/+4=あいてが引く ★=色をえらべる<br>のこり1枚になるときは「UNO!!」宣言。さきに出しきったら勝ち!",

  initData() {
    const d = { deck: shuffleArr(buildDeck()), disc: [], hands: { a: [], b: [] }, drew: null, msg: "", uno: null };
    for (let i = 0; i < 7; i++) { d.hands.a.push(d.deck.pop()); d.hands.b.push(d.deck.pop()); }
    // 最初の場札は数字カードになるまでめくる(記号スタートの複雑さを避ける定番処理)
    let top = d.deck.pop();
    while (!/[0-9]/.test(top[1])) { d.deck.unshift(top); top = d.deck.pop(); }
    d.disc = [top];
    d.color = top[0];
    d.turn = "b";            // 配り手=さそった人(a)なので、うけた人(b)が先攻
    return d;
  },

  statsHtml(st) {
    const g = st.byGame?.uno || {};
    return `<span>せんせき ${g.wins || 0}勝${(g.played || 0) - (g.wins || 0)}敗</span>`;
  },

  render(el, m) {
    const d = m.data;
    const mySeat = seatOf(m, S.uid);
    const opSeat = otherSeat(mySeat);
    const opUid = m.players[opSeat];
    const meP = personOf(S.uid), paP = personOf(opUid);
    const myHand = d.hands[mySeat] || [];
    const opCount = (d.hands[opSeat] || []).length;
    const myTurn = d.turn === mySeat;
    const top = d.disc[d.disc.length - 1];

    el.innerHTML = `
      <div class="u-op">
        <span class="mem-chip" style="--pc:${paP.color}">${paP.emoji} ${esc(paP.name)}
          <b>${opCount}枚</b></span>
        ${opCount === 1 ? `<span class="u-unobadge">UNO!</span>` : ""}
        <div class="u-opbacks">${`<i class="u-back mini"></i>`.repeat(Math.min(opCount, 12))}${opCount > 12 ? `<small>+${opCount - 12}</small>` : ""}</div>
      </div>

      <div class="u-table">
        <div class="u-pile">
          <i class="u-back"></i><small>のこり ${d.deck.length}</small>
        </div>
        <div class="u-disc">${cardHTML(top, { cls: "big pop" })}</div>
        <div class="u-colors">
          ${COLORS.map((c) => `<i class="u-dot u-${c} ${d.color === c ? "on" : ""}"></i>`).join("")}
        </div>
      </div>

      <p class="u-msg">${d.msg ? esc(d.msg) : myTurn ? "あなたの番! カードをえらんでね" : `${esc(paP.name)}の番…`}</p>

      <div class="u-actions">
        ${myTurn && d.drew == null ? `<button class="btn btn-ghost btn-sm" id="u-draw">やまふだから ひく</button>` : ""}
        ${myTurn && d.drew != null ? `<button class="btn btn-ghost btn-sm" id="u-pass">パスする</button>` : ""}
      </div>

      <div class="u-hand ${myTurn ? "" : "dimhand"}">
        ${myHand.map((card, i) => {
          const ok = myTurn && playable(card, top, d.color) && (d.drew == null || i === d.drew);
          return cardHTML(card, {
            cls: `${ok ? "ok" : "off"} ${i === d.drew ? "drawn" : ""}`,
            attr: `data-i="${i}" role="button"`,
          });
        }).join("")}
      </div>
      <p class="dim center small-note">じぶんの手札 ${myHand.length}枚${d.drew != null && myTurn ? "・ひいたカードだけ出せるよ" : ""}</p>
      ${d.uno && Date.now() - d.uno.ts < 2500 ? `<div class="u-splash">UNO!!</div>` : ""}
    `;

    if (myTurn) {
      el.querySelector("#u-draw")?.addEventListener("click", () => this.draw());
      el.querySelector("#u-pass")?.addEventListener("click", () => this.pass());
      el.querySelectorAll(".u-card.ok").forEach((c) => {
        c.addEventListener("click", () => this.tryPlay(+c.dataset.i, myHand));
      });
    }
  },

  /** カードを出す前の確認(ワイルドの色えらび / UNO宣言) */
  tryPlay(idx, hand) {
    const card = hand[idx];
    const goesUno = hand.length === 2;
    const doPlay = (color) => {
      if (goesUno) {
        const body = `<p class="center" style="font-size:17px">のこり1枚! さけんで出そう</p>`;
        modal({
          title: "🗣️ UNO宣言", body,
          actions: [
            { label: "やめる", cls: "btn-ghost" },
            { label: "UNO!!", cls: "btn-primary", onClick: (c) => { c(); this.play(idx, color, true); } },
          ],
        });
      } else {
        this.play(idx, color, false);
      }
    };
    if (card[0] === "W") {
      const body = document.createElement("div");
      body.innerHTML = `<div class="u-pickrow">${COLORS.map((c) =>
        `<button class="u-pick u-${c}" data-c="${c}">${COLOR_JP[c]}</button>`).join("")}</div>`;
      const mm = modal({ title: "🎨 色をえらぶ", body });
      body.querySelectorAll(".u-pick").forEach((b) => {
        b.onclick = () => { mm.close(); doPlay(b.dataset.c); };
      });
    } else {
      doPlay(null);
    }
  },

  play(idx, chosenColor, declaredUno) {
    return txMatch((m) => {
      if (m.status !== "active" || m.gameId !== this.id) return false;
      const d = m.data;
      const seat = seatOf(m, S.uid);
      if (d.turn !== seat) return false;
      if (d.drew != null && idx !== d.drew) return false;
      const hand = d.hands[seat] || [];
      const card = hand[idx];
      const top = d.disc[d.disc.length - 1];
      if (!card || !playable(card, top, d.color)) return false;

      hand.splice(idx, 1);
      d.disc = [...d.disc, card];
      d.color = card[0] === "W" ? (chosenColor || "R") : card[0];
      d.drew = null;
      const me = personOf(S.uid).name;

      const v = card[1];
      if (v === "S" || v === "R") {
        d.msg = `${me}の${v === "S" ? "スキップ⊘" : "リバース⇄"}! もういちど${me}の番`;
        // 2人対戦: 手番そのまま
      } else if (v === "D" || v === "F") {
        const n = v === "D" ? 2 : 4;
        const op = otherSeat(seat);
        for (let i = 0; i < n; i++) { const c = take(d); if (c) d.hands[op].push(c); }
        d.msg = `${v === "D" ? "+2" : "+4"}! あいてが${n}枚ひいた`;
        // ひかされた側は手番スキップ → 手番そのまま
      } else {
        d.turn = otherSeat(seat);
        d.msg = "";
      }

      if (hand.length === 1) d.uno = { by: seat, ts: Date.now(), declared: !!declaredUno };
      if (hand.length === 0) { d.winner = seat; m.status = "result"; }

      m.updatedAt = Date.now();
      return m;
    });
  },

  draw() {
    return txMatch((m) => {
      if (m.status !== "active" || m.gameId !== this.id) return false;
      const d = m.data;
      const seat = seatOf(m, S.uid);
      if (d.turn !== seat || d.drew != null) return false;
      const card = take(d);
      const top = d.disc[d.disc.length - 1];
      if (!card) { d.turn = otherSeat(seat); d.msg = "ひけるカードがない! パス"; m.updatedAt = Date.now(); return m; }
      d.hands[seat].push(card);
      if (playable(card, top, d.color)) {
        d.drew = d.hands[seat].length - 1;   // ひいたカードは出してもいい
        d.msg = "";
      } else {
        d.turn = otherSeat(seat);            // 出せないので自動でパス
        d.drew = null;
        d.msg = "ひいたけど出せなかった…";
      }
      m.updatedAt = Date.now();
      return m;
    });
  },

  pass() {
    return txMatch((m) => {
      if (m.status !== "active" || m.gameId !== this.id) return false;
      const d = m.data;
      const seat = seatOf(m, S.uid);
      if (d.turn !== seat || d.drew == null) return false;
      d.turn = otherSeat(seat);
      d.drew = null;
      d.msg = "";
      m.updatedAt = Date.now();
      return m;
    });
  },

  renderResult(m) {
    const wUid = m.players[m.data.winner];
    const w = personOf(wUid);
    const mine = wUid === S.uid;
    return `
      <div class="result-icon">🌈</div>
      <h2>${esc(w.name)}の勝ち!</h2>
      <div class="result-stars">${mine ? "🏆" : "👏"}</div>
      <p>${mine ? "みごとに出しきった!" : "つぎはリベンジだ!"}</p>
      <p class="result-reward">🪙 かち+50 / まけ+20 / 🍚+1ずつ / ペットに ✨+30</p>`;
  },

  async rewards(m, isHost) {
    const win = m.players[m.data.winner] === S.uid;
    if (!isHost) {
      await addCoins(win ? 50 : 20);
      await addFood(1);
      await recordResult("uno", win ? "win" : "lose");
      logH("game", { gameId: "uno", result: win ? "win" : "lose" });
      if (win) confetti(36);
    } else {
      await gainExp(30, "UNO");
      await addPersonality("yuukan", 2);
    }
  },
};
