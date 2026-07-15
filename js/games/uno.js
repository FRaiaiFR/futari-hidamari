// =====================================================================
// UNO(1対1オンライン対戦) — ルール拡張版
// カード表記: 色(R/G/B/Y/W) + 値(0-9, S=スキップ, R=リバース, D=+2, W=ワイルド, F=+4)
//
// 2人対戦ルール:
//  ・スキップ/リバース: 出すと手番は相手へ渡る(ただしリバースには色/リバース制約が付く)
//  ・リバース直後の相手は「同じ色」または「別色のリバース」しか出せない(出せなければ引く)
//  ・+2/+4: 出すと手番は相手へ。受け手は +2/+4 を持っていれば「重ねる」選択可(スタッキング)
//    重ねられなくなった人が累積枚数をまとめて引く。カットイン演出を表示。
//  ・UNO演出は「2枚→1枚になった瞬間」だけ(状態にフラグを持たせ再表示しない)
// =====================================================================
import { txMatch } from "../core/match.js";
import { S, personOf, partnerUid } from "../core/state.js";
import { esc, modal, confetti, toast } from "../core/ui.js";
import { addCoins, addFood, recordResult } from "../core/economy.js";
import { gainExp, addPersonality } from "../pet/pet.js";
import { logH } from "../core/history.js";
import { SE } from "../core/sound.js";

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

/** 通常の出せる判定(色一致 or 数字/記号一致 or ワイルド) */
export const playable = (card, top, color) =>
  card[0] === "W" || card[0] === color || card[1] === top[1];

/** リバース制約下の出せる判定: 同じ色 or 別色のリバース のみ */
export const playableAfterReverse = (card, color) =>
  card[0] === color || card[1] === "R";

/** スキップ制約下の出せる判定: 同じ色 or 別色のスキップ のみ(スキップ同士は色不問) */
export const playableAfterSkip = (card, color) =>
  card[0] === color || card[1] === "S";

/** 制約種別に応じた出せる判定 */
export function playableUnder(constraint, card, top, color) {
  if (constraint === "reverse") return playableAfterReverse(card, color);
  if (constraint === "skip") return playableAfterSkip(card, color);
  return playable(card, top, color);
}

const isDraw = (card) => card[1] === "D" || card[1] === "F";
const drawCount = (card) => (card[1] === "D" ? 2 : 4);
const seatOf = (m, uid) => (m.players.a === uid ? "a" : "b");
const otherSeat = (s) => (s === "a" ? "b" : "a");

/** 手番を確定させる唯一の入口。turn と turnStamp を必ずセットで更新する。
 *  これを通すことで、どのルートのターン遷移でも「ターン開始」を漏れなく検出できる。 */
let _stampCounter = 0;
function setTurn(d, seat) {
  d.turn = seat;
  d.turnStamp = Date.now() * 1000 + (++_stampCounter % 1000); // 常に一意で単調増加
}

/** 山札から1枚(切れたら捨て札を再シャッフル) */
function take(d) {
  if (!d.deck.length) {
    if (d.disc.length <= 1) return null;
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
  rules: "同じ色か同じ数字・記号のカードを出せるよ。<br>⊘=スキップ ⇄=リバース(次は同じ色か別色のリバースのみ) +2/+4=あいてが引く(重ねOK) ★=色をえらべる<br>のこり1枚で「UNO!!」、さきに出しきったら勝ち!",
  rematchable: true,

  initData() {
    const d = {
      deck: shuffleArr(buildDeck()), disc: [], hands: { a: [], b: [] },
      drew: null, msg: "", uno: null, unoShown: {},
      constraint: null,     // "reverse" のとき、次の手番は色orリバース制約
      pending: 0,           // +2/+4 の累積ドロー枚数(スタッキング中)
      cutin: null,          // ドローカットイン {seat, n, ts}
    };
    for (let i = 0; i < 7; i++) { d.hands.a.push(d.deck.pop()); d.hands.b.push(d.deck.pop()); }
    let top = d.deck.pop();
    while (!/[0-9]/.test(top[1])) { d.deck.unshift(top); top = d.deck.pop(); }
    d.disc = [top]; d.color = top[0]; setTurn(d, "b");
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

    // ---- ターン開始の共通処理 ----
    // どのルート(通常・スキップ・リバース・+2/+4ドロー後・引いて出せずパス後)から
    // 手番が来ても、ここ一箇所で「あなたのターンです」を必ず表示する。
    // updatedAt をキーに「新しく自分の番になった瞬間」だけ発火(再描画では出さない)。
    this._notifyTurn(m, myTurn);

    // 出せるカードの判定(制約・スタッキングを考慮)
    const canPlay = (card, i) => {
      if (!myTurn) return false;
      if (d.pending > 0) return isDraw(card);                       // スタッキング中は+カードのみ
      if (d.constraint) return playableUnder(d.constraint, card, top, d.color);
      if (d.drew != null) return i === d.drew && playable(card, top, d.color);
      return playable(card, top, d.color);
    };

    // ---- 手札を色ごとに整理(赤→青→緑→黄、各色内は数字→特殊、ワイルドは最後) ----
    // 元のindexは操作に必要なので保持したまま並べ替える。
    const COLOR_ORDER = { R: 0, B: 1, G: 2, Y: 3, W: 4 };
    const valRank = (v) => {
      if (/[0-9]/.test(v)) return +v;      // 数字: 0〜9
      return 10 + ["S", "R", "D"].indexOf(v); // 特殊: スキップ→リバース→+2 の順で数字の後ろ
    };
    const ordered = myHand
      .map((c, i) => ({ c, i }))
      .sort((x, y) => {
        const co = COLOR_ORDER[x.c[0]] - COLOR_ORDER[y.c[0]];
        if (co !== 0) return co;
        return valRank(x.c[1]) - valRank(y.c[1]);
      });

    // 色ごとにグループ化 → 各グループを最大5枚ずつの段に分割
    const groups = [];
    for (const item of ordered) {
      const col = item.c[0];
      let g = groups[groups.length - 1];
      if (!g || g.col !== col) { g = { col, items: [] }; groups.push(g); }
      g.items.push(item);
    }
    const COLOR_CLASS = { R: "u-g-R", G: "u-g-G", B: "u-g-B", Y: "u-g-Y", W: "u-g-W" };

    el.innerHTML = `
      <div class="u-op">
        <span class="mem-chip" style="--pc:${paP.color}">${paP.emoji} ${esc(paP.name)}
          <b>${opCount}枚</b></span>
        ${opCount === 1 ? `<span class="u-unobadge">UNO!</span>` : ""}
        <div class="u-opbacks">${`<i class="u-back mini"></i>`.repeat(Math.min(opCount, 12))}${opCount > 12 ? `<small>+${opCount - 12}</small>` : ""}</div>
      </div>

      <div class="u-table">
        <div class="u-pile" ${myTurn && d.pending === 0 && d.drew == null ? `id="u-pilebtn"` : ""}>
          <i class="u-back"></i><small>のこり ${d.deck.length}</small>
        </div>
        <div class="u-disc">${cardHTML(top, { cls: "big pop" })}</div>
        <div class="u-colors">
          ${COLORS.map((c) => `<i class="u-dot u-${c} ${d.color === c ? "on" : ""}"></i>`).join("")}
        </div>
      </div>

      ${d.pending > 0 ? `<div class="u-pending">＋カード累積 <b>${d.pending}枚</b></div>` : ""}
      ${d.constraint === "reverse" ? `<p class="u-constraint">⇄ リバース! 同じ色か、別の色のリバースしか出せないよ</p>` : ""}
      ${d.constraint === "skip" ? `<p class="u-constraint">⊘ スキップ! 同じ色か、別の色のスキップしか出せないよ</p>` : ""}

      <p class="u-msg">${d.msg ? esc(d.msg) : myTurn ? "あなたの番!" : `${esc(paP.name)}の番…`}</p>

      <div class="u-hand-colors ${myTurn ? "" : "dimhand"}">
        ${groups.map((g) => {
          // 各色グループを最大5枚ずつの段に割る
          const rows = [];
          for (let i = 0; i < g.items.length; i += 5) rows.push(g.items.slice(i, i + 5));
          return `<div class="u-cgroup ${COLOR_CLASS[g.col]}">
            ${rows.map((row) => `<div class="u-hand-row">
              ${row.map(({ c, i }) => {
                const ok = canPlay(c, i);
                return cardHTML(c, { cls: `${ok ? "ok" : "off"} ${i === d.drew ? "drawn" : ""}`, attr: `data-i="${i}"` });
              }).join("")}
            </div>`).join("")}
          </div>`;
        }).join("")}
      </div>
      <p class="dim center small-note">じぶんの手札 ${myHand.length}枚</p>

      ${myTurn && d.drew != null && d.pending === 0 ? `<div class="u-actions"><button class="btn btn-ghost btn-sm" id="u-pass">パスする</button></div>` : ""}

      ${d.cutin && Date.now() - d.cutin.ts < 2600 ? `<div class="u-cutin"><b>山札から${d.cutin.n}枚 取りました</b></div>` : ""}
      ${this.unoSplashHtml(d, mySeat)}
    `;

    // ---- スタッキング中の受け手には選択ダイアログ ----
    if (myTurn && d.pending > 0 && !d._askedPending) {
      const hasDrawCard = myHand.some(isDraw);
      if (hasDrawCard) this.askPending(d.pending);
      else this.takePending();   // 重ねられない → 自動で引く
    }

    // ---- 操作 ----
    el.querySelector("#u-pilebtn")?.addEventListener("click", () => this.draw());
    el.querySelector("#u-pass")?.addEventListener("click", () => this.pass());
    el.querySelectorAll(".u-card.ok").forEach((c) => {
      c.addEventListener("click", () => this.tryPlay(+c.dataset.i, myHand));
    });

    // カットインは自動で閉じる(再描画をうながす)
    if (d.cutin && Date.now() - d.cutin.ts < 2600) {
      setTimeout(() => { if (S.match?.data?.cutin?.ts === d.cutin.ts) this.clearCutin(); }, 2600);
    }

    // UNO演出を出したら「見た」と記録して、次ターン以降の再表示を防ぐ
    const splash = el.querySelector(".u-splash");
    if (splash) {
      const ts = +splash.dataset.uno;
      SE("tap");
      setTimeout(() => this.markUnoShown(ts), 2000);
    }
  },

  /** ターン開始の共通通知。手番が確定した瞬間に打たれる turnStamp を見て、
   *  自分の番になった各回で1度だけ「あなたのターンです」を出す。
   *  カットイン更新やUNO既読など「手番と無関係な更新」では発火しない。 */
  _notifyTurn(m, myTurn) {
    const stamp = m.data.turnStamp || 0;
    if (this._seenStamp === stamp) return;   // このターン開始は通知済み
    this._seenStamp = stamp;
    if (myTurn && !m.data.winner) toast("あなたのターンです", "🌈");
  },
    // 「2→1になった瞬間」だけ。表示済みなら出さない
    if (!d.uno || d.unoShown?.[d.uno.ts]) return "";
    return `<div class="u-splash" data-uno="${d.uno.ts}">UNO!!</div>`;
  },

  askPending(total) {
    const d = S.match.data;
    d._askedPending = true;  // ダイアログの多重表示を防ぐ(ローカルのみ)
    modal({
      title: "＋カードがきた!",
      body: `<p class="center" style="font-size:17px">相手の＋カードで <b>${total}枚</b> ドローされます。<br>＋カードを重ねて 相手に返せます!</p>`,
      actions: [
        { label: `山札から${total}枚取る`, cls: "btn-ghost", onClick: (c) => { c(); this.takePending(); } },
        { label: "カードを重ねる", cls: "btn-primary", onClick: (c) => { c(); d._askedPending = false; } },
      ],
    });
  },

  tryPlay(idx, hand) {
    const card = hand[idx];
    const d = S.match.data;
    const goesUno = hand.length === 2;
    const doPlay = (color) => {
      if (goesUno) {
        modal({
          title: "🗣️ UNO宣言",
          body: `<p class="center" style="font-size:17px">のこり1枚! さけんで出そう</p>`,
          actions: [
            { label: "やめる", cls: "btn-ghost" },
            { label: "UNO!!", cls: "btn-primary", onClick: (c) => { c(); this.play(idx, color, true); } },
          ],
        });
      } else this.play(idx, color, false);
    };
    if (card[0] === "W") {
      const body = document.createElement("div");
      body.innerHTML = `<div class="u-pickrow">${COLORS.map((c) =>
        `<button class="u-pick u-${c}" data-c="${c}">${COLOR_JP[c]}</button>`).join("")}</div>`;
      const mm = modal({ title: "🎨 色をえらぶ", body });
      body.querySelectorAll(".u-pick").forEach((b) => {
        b.onclick = () => { mm.close(); doPlay(b.dataset.c); };
      });
    } else doPlay(null);
  },

  play(idx, chosenColor, declaredUno) {
    return txMatch((m) => {
      if (m.status !== "active" || m.gameId !== this.id) return false;
      const d = m.data;
      const seat = seatOf(m, S.uid);
      if (d.turn !== seat) return false;
      const hand = d.hands[seat] || [];
      const card = hand[idx];
      if (!card) return false;
      const top = d.disc[d.disc.length - 1];

      // 出せるかを最終チェック(制約・スタッキング・引いた直後)
      if (d.pending > 0) { if (!isDraw(card)) return false; }
      else if (d.constraint) { if (!playableUnder(d.constraint, card, top, d.color)) return false; }
      else if (d.drew != null) { if (idx !== d.drew || !playable(card, top, d.color)) return false; }
      else if (!playable(card, top, d.color)) return false;

      hand.splice(idx, 1);
      d.disc = [...d.disc, card];
      d.color = card[0] === "W" ? (chosenColor || "R") : card[0];
      d.drew = null;
      d.constraint = null;
      d._askedPending = false;
      const me = personOf(S.uid).name;
      const v = card[1];

      // UNO演出フラグ(2→1になった瞬間だけ)
      if (hand.length === 1 && (!d.uno || d.uno.seat !== seat)) {
        d.uno = { seat, ts: Date.now(), declared: !!declaredUno };
      }

      if (isDraw(card)) {
        d.pending = (d.pending || 0) + drawCount(card);
        setTurn(d, otherSeat(seat));     // 相手へ(重ねるか引くか)
        d.msg = `${me}の${v === "D" ? "+2" : "+4"}! 累積${d.pending}枚`;
      } else if (v === "S") {
        // 2人ルール: スキップは相手を飛ばして自分が続けてプレイ。
        // ただし次に出せるのは「同じ色 or 別色のスキップ」のみ(制約)。
        setTurn(d, seat);                // 手番はそのまま自分(スキップ)
        d.constraint = "skip";
        d.msg = `${me}のスキップ⊘! もういちど${me}の番`;
      } else if (v === "R") {
        setTurn(d, otherSeat(seat));     // リバースも相手へ、ただし制約付き
        d.constraint = "reverse";
        d.msg = `${me}のリバース⇄!`;
      } else {
        setTurn(d, otherSeat(seat));
        d.msg = "";
      }

      if (hand.length === 0) { d.winner = seat; m.status = "result"; }
      m.updatedAt = Date.now();
      return m;
    });
  },

  /** スタッキングを打ち切って累積枚数を引く */
  takePending() {
    return txMatch((m) => {
      if (m.status !== "active" || m.gameId !== this.id) return false;
      const d = m.data;
      const seat = seatOf(m, S.uid);
      if (d.turn !== seat || d.pending <= 0) return false;
      const n = d.pending;
      for (let i = 0; i < n; i++) { const c = take(d); if (c) d.hands[seat].push(c); }
      d.pending = 0;
      d._askedPending = false;
      d.cutin = { seat, n, ts: Date.now() };
      // 引いた本人がそのまま自分のターンでプレイを続ける(手番は移さない)
      setTurn(d, seat);
      d.constraint = null;
      d.drew = null;
      d.msg = "";
      m.updatedAt = Date.now();
      return m;
    });
  },

  draw() {
    return txMatch((m) => {
      if (m.status !== "active" || m.gameId !== this.id) return false;
      const d = m.data;
      const seat = seatOf(m, S.uid);
      if (d.turn !== seat || d.drew != null || d.pending > 0) return false;
      const card = take(d);
      const top = d.disc[d.disc.length - 1];
      if (!card) { setTurn(d, otherSeat(seat)); d.msg = "ひけるカードがない! パス"; d.constraint = null; m.updatedAt = Date.now(); return m; }
      d.hands[seat].push(card);
      // 制約下では引いたカードも制約に従う
      const ok = d.constraint ? playableUnder(d.constraint, card, top, d.color) : playable(card, top, d.color);
      if (ok) { d.drew = d.hands[seat].length - 1; d.msg = ""; }
      else { setTurn(d, otherSeat(seat)); d.drew = null; d.constraint = null; d.msg = "ひいたけど出せなかった…"; }
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
      setTurn(d, otherSeat(seat)); d.drew = null; d.constraint = null; d.msg = "";
      m.updatedAt = Date.now();
      return m;
    });
  },

  clearCutin() {
    return txMatch((m) => {
      if (!m.data?.cutin) return false;
      m.data.cutin = null; m.updatedAt = Date.now(); return m;
    });
  },

  // UNO演出を「見た」と記録(再表示防止)
  markUnoShown(ts) {
    return txMatch((m) => {
      const d = m.data;
      if (!d.uno || d.uno.ts !== ts || d.unoShown?.[ts]) return false;
      d.unoShown = { ...(d.unoShown || {}), [ts]: true };
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

  summary(m) {
    const d = m.data;
    const loserSeat = d.winner === "a" ? "b" : "a";
    return { kind: "vs", winner: m.players[d.winner], loserCards: (d.hands?.[loserSeat] || []).length };
  },

  async rewards(m, isHost) {
    const win = m.players[m.data.winner] === S.uid;
    if (!isHost) {
      await addCoins(win ? 50 : 20);
      await addFood(1);
      await recordResult("uno", win ? "win" : "lose");
      logH("game", { gameId: "uno", result: win ? "win" : "lose" });
      if (win) { confetti(36); SE("win"); }
    } else {
      await gainExp(30, "UNO");
      await addPersonality("yuukan", 2);
    }
  },
};
