// =====================================================================
// リアルタイム対戦の状態機械
// invite → active → result → idle の一本道。DBの match ノードが唯一の真実。
// ゲーム側は {id, name, icon, desc, rules, initData, render, rewards}
// を register() するだけで、招待・同期・タイムアウト・報酬配布が動く。
// =====================================================================
import { tx, r, set } from "./firebase.js";
import { S, emit, personOf, partnerUid } from "./state.js";
import { toast, modal, esc, confirmDlg } from "./ui.js";
import { logH } from "./history.js";
import { checkAll } from "./achievements.js";

export const MATCH_GAMES = {};
export function register(mod) { MATCH_GAMES[mod.id] = mod; }

const STALE_MS = 90 * 1000;        // これを超えて更新がないと「応答なし」表示
const DEAD_MS = 10 * 60 * 1000;    // これを超えた試合は起動時に自動破棄

export const isStale = (m) => m?.updatedAt && Date.now() - m.updatedAt > STALE_MS;

/** matchノードのトランザクション。fn が false を返すと中断。 */
export function txMatch(fn) {
  return tx("match", (m) => fn(m || { status: "idle" }));
}

/** さそう */
export async function invite(gameId) {
  const res = await txMatch((m) => {
    const busy = m.status && m.status !== "idle" && Date.now() - (m.updatedAt || 0) < DEAD_MS;
    if (busy) return false;
    return { status: "invite", gameId, invitedBy: S.uid, updatedAt: Date.now() };
  });
  if (!res.committed) { toast("いま対戦の準備中みたい。少し待ってね", "⏳"); return false; }
  logH("invite", { gameId });
  return true;
}

/** さそいを受ける */
export function accept() {
  return txMatch((m) => {
    if (m.status !== "invite" || m.invitedBy === S.uid) return false;
    const mod = MATCH_GAMES[m.gameId];
    if (!mod) return false;
    return {
      status: "active", gameId: m.gameId, invitedBy: m.invitedBy,
      players: { a: m.invitedBy, b: S.uid },
      data: mod.initData(), claimed: {},
      updatedAt: Date.now(),
    };
  });
}

/** ことわる / とりさげる */
export function cancelInvite() {
  return txMatch((m) => (m.status === "invite" ? { status: "idle" } : false));
}

/** 試合を中止(確認つき) */
export async function abort() {
  if (!(await confirmDlg("この対戦を中止する？(記録は残りません)", "中止する"))) return;
  await set(r("match"), { status: "idle" });
  logH("abort");
}

/** 古い試合の掃除(起動時に呼ぶ) */
export function cleanupDead() {
  return txMatch((m) => {
    if (m.status && m.status !== "idle" && Date.now() - (m.updatedAt || 0) > DEAD_MS) {
      return { status: "idle" };
    }
    return false;
  }).catch(() => {});
}

// ---------------------------------------------------------------------
// グローバル監視: match の状態に応じて モーダル / 全画面オーバーレイ を管理
// ---------------------------------------------------------------------
let inviteModal = null;
let seenInviteAt = 0;
let overlay = null;

export function handleMatchChange() {
  const m = S.match;
  const st = m?.status || "idle";

  // --- 招待の着信 ---
  if (st === "invite" && m.invitedBy !== S.uid && m.updatedAt !== seenInviteAt) {
    seenInviteAt = m.updatedAt;
    const mod = MATCH_GAMES[m.gameId];
    const who = personOf(m.invitedBy);
    inviteModal?.close();
    inviteModal = modal({
      title: `${mod?.icon || "🎮"} 対戦のおさそい`,
      body: `<p class="center"><b style="color:${who.color}">${esc(who.name)}</b> から<br>「${esc(mod?.name || "")}」のおさそい！</p>`,
      dismissable: false,
      actions: [
        { label: "またこんど", cls: "btn-ghost", onClick: (c) => { c(); cancelInvite(); } },
        { label: "あそぶ！", cls: "btn-primary", onClick: (c) => { c(); accept(); } },
      ],
    });
    return;
  }
  if (st !== "invite") { inviteModal?.close(); inviteModal = null; }

  // --- 進行中 / 結果: 全画面オーバーレイ ---
  if (st === "active" || st === "result") {
    const mod = MATCH_GAMES[m.gameId];
    if (!mod) return;
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "game-ovl";
      overlay.innerHTML = `
        <div class="game-head">
          <span class="gh-title">${mod.icon} ${esc(mod.name)}</span>
          <button class="gh-abort btn btn-ghost btn-sm">中止</button>
        </div>
        <div class="game-body"></div>
        <div class="game-stale hidden">あいての応答がありません…電波が悪いのかも。<br>「中止」でいつでも終われます。</div>`;
      overlay.querySelector(".gh-abort").onclick = abort;
      document.body.appendChild(overlay);
    }
    overlay.querySelector(".game-stale").classList.toggle("hidden", !isStale(m));
    if (st === "active") mod.render(overlay.querySelector(".game-body"), m);
    else renderResult(overlay.querySelector(".game-body"), m, mod);
    return;
  }

  // --- idle: 片付け ---
  if (overlay) { overlay.remove(); overlay = null; }
  emit("match:idle");
}

// ---- 結果画面と報酬配布 -------------------------------------------------
async function renderResult(el, m, mod) {
  await claimRewards(m, mod);
  const html = mod.renderResult ? mod.renderResult(m) : "";
  el.innerHTML = `
    <div class="result-wrap">
      ${html}
      <button class="btn btn-primary btn-big close-result">へやにもどる</button>
    </div>`;
  el.querySelector(".close-result").onclick = () =>
    txMatch((mm) => (mm.status === "result" ? { status: "idle" } : false));
}

/** 報酬の受け取り(1人1回・ペット分はホスト1回のみ、二重付与防止) */
async function claimRewards(m, mod) {
  const isHost = m.invitedBy === S.uid;
  // 自分の分
  const mine = await txMatch((mm) => {
    if (mm.status !== "result" || mm.claimed?.[S.uid]) return false;
    mm.claimed = { ...(mm.claimed || {}), [S.uid]: true };
    return mm;
  });
  if (mine.committed) {
    try { await mod.rewards(m, false); } catch (e) { console.error(e); }
  }
  // ペット・共有分(ホストのクライアントが1回だけ)
  if (isHost) {
    const petClaim = await txMatch((mm) => {
      if (mm.status !== "result" || mm.claimed?.pet) return false;
      mm.claimed = { ...(mm.claimed || {}), pet: true };
      return mm;
    });
    if (petClaim.committed) {
      try { await mod.rewards(m, true); } catch (e) { console.error(e); }
    }
  }
  checkAll();
}
