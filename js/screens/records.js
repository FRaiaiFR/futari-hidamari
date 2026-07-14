// =====================================================================
// きろく画面: 履歴 / じっせき / ごほうび券 / ペットの年表
// =====================================================================
import { S, me, personOf } from "../core/state.js";
import { esc, fmtDateTimeJP, confirmDlg } from "../core/ui.js";
import { fetchHistory, fetchPetLog } from "../core/history.js";
import { ACHIEVEMENTS, REWARDS } from "../data/masters.js";
import { useReward } from "../core/achievements.js";
import { MISSIONS, weeklyProgress, claimMission, weekKey } from "../core/missions.js";
import { MATCH_GAMES } from "../core/match.js";
import { r, get, query, limitToLast, remove } from "../core/firebase.js";
import { QUESTIONS } from "../data/questions.js";
import { renderPetSVG } from "../pet/petView.js";
import { fmtDateJP, modal } from "../core/ui.js";

let sub = "log";

export function render(el) {
  const u = me() || {};
  const st = u.stats || {};
  el.innerHTML = `
  <div class="records">
    <h2 class="page-title">📖 きろく</h2>
    <div class="stats-strip">
      <div><b>${st.wins || 0}</b><small>勝利</small></div>
      <div><b>${u.loginStreak || 0}</b><small>連続日</small></div>
      <div><b>💗${S.shared?.heartsTotal || 0}</b><small>かけら累計</small></div>
      <div><b>Lv${S.pet?.level || 1}</b><small>ペット</small></div>
    </div>
    <div class="lv-chips chips-scroll">
      ${[["log", "📜 履歴"], ["mis", "🎯 ミッション"], ["match", "🎮 たいせん"], ["ach", "🏆 じっせき"],
         ["rw", "🎟️ ごほうび"], ["dex", "📔 じてん"], ["tl", "🐾 ねんぴょう"], ["card", "🖼️ カード"]]
        .map(([id, lb]) => `<button class="lv-chip ${sub === id ? "on" : ""}" data-s="${id}">${lb}</button>`).join("")}
    </div>
    <div id="rec-body"><div class="loading-inline">よみこみ中…</div></div>
  </div>`;
  el.querySelectorAll("[data-s]").forEach((b) => {
    b.onclick = () => { sub = b.dataset.s; render(el); };
  });
  const body = el.querySelector("#rec-body");
  if (sub === "log") paintLog(body);
  else if (sub === "mis") paintMissions(body, el);
  else if (sub === "match") paintMatches(body, el);
  else if (sub === "ach") paintAch(body);
  else if (sub === "rw") paintRewards(body, el);
  else if (sub === "dex") paintDex(body);
  else if (sub === "card") paintCard(body);
  else paintTimeline(body);
}

const H_LABEL = {
  login: (h) => "あそびに来た",
  feed: () => "ごはんをあげた 🍚",
  pet: () => "なでた 🫶",
  talk: () => "質問にこたえた 💬",
  game: (h) => h.gameId === "coin" ? `コイン対決(${h.win ? "勝ち🏆" : "まけ"})` : `ことばあわせ(💞×${h.matches ?? 0})`,
  achievement: (h) => `じっせき「${h.name}」を解除 🏆`,
  reward_get: (h) => `ごほうび券「${h.name}」をゲット 🎟️`,
  reward_use: (h) => `ごほうび券「${h.name}」を使った ✅`,
  dress: (h) => `「${h.name}」を買った 🎀`,
  invite: () => "対戦にさそった 🎮",
  abort: () => "対戦を中止した",
};

async function paintLog(body) {
  const items = await fetchHistory(60);
  if (!items.length) { body.innerHTML = `<p class="dim center">まだ記録がないよ。きょうから始めよう!</p>`; return; }
  body.innerHTML = `<div class="h-list">
    ${items.map((h) => {
      const p = personOf(h.uid);
      const label = (H_LABEL[h.type] || (() => h.type))(h);
      return `<div class="h-item" style="--pc:${p.color}">
        <span class="h-who">${p.emoji}</span>
        <span class="h-txt"><b>${esc(p.name)}</b> ${label}</span>
        <small>${fmtDateTimeJP(h.ts)}</small></div>`;
    }).join("")}
  </div>`;
}

function paintAch(body) {
  const got = me()?.achievements || {};
  const solo = ACHIEVEMENTS.filter((a) => !a.pair);
  const pair = ACHIEVEMENTS.filter((a) => a.pair);
  const grid = (list) => `<div class="ach-grid">
    ${list.map((a) => `
      <div class="ach ${got[a.id] ? "on" : ""}">
        <span class="a-ico">${got[a.id] ? a.icon : "🔒"}</span>
        <b>${esc(a.name)}</b><small>${esc(a.desc)}</small>
      </div>`).join("")}
  </div>`;
  body.innerHTML = `${grid(solo)}
    <h4>💞 ふたりで解除</h4>${grid(pair)}
    <p class="dim center">${Object.keys(got).length} / ${ACHIEVEMENTS.length} 解除</p>`;
}

function paintRewards(body, screenEl) {
  const mine = me()?.rewards || {};
  const owned = REWARDS.filter((r) => mine[r.id] && !mine[r.id].usedAt);
  const used = REWARDS.filter((r) => mine[r.id]?.usedAt);
  const locked = REWARDS.filter((r) => !mine[r.id]);
  body.innerHTML = `
    <h4>つかえる券</h4>
    ${owned.length ? owned.map((rw) => `
      <div class="rw-item">
        <span class="rw-ico">${rw.icon}</span>
        <div class="rw-txt"><b>${esc(rw.name)}</b><small>${esc(rw.desc)}</small></div>
        <button class="btn btn-primary btn-sm" data-use="${rw.id}">使う</button>
      </div>`).join("") : `<p class="dim">いまは持っていないよ</p>`}
    <h4>これからの券</h4>
    ${locked.map((rw) => `
      <div class="rw-item locked">
        <span class="rw-ico">🔒</span>
        <div class="rw-txt"><b>${esc(rw.name)}</b><small>条件: ${esc(rw.condDesc)}</small></div>
      </div>`).join("")}
    ${used.length ? `<h4>つかった券</h4>` + used.map((rw) => `
      <div class="rw-item used">
        <span class="rw-ico">${rw.icon}</span>
        <div class="rw-txt"><b>${esc(rw.name)}</b><small>${fmtDateTimeJP(mine[rw.id].usedAt)} に使用</small></div>
      </div>`).join("") : ""}
    <p class="dim center small-note">「使う」を押して、あいてに画面を見せてね。現実のごほうびと交換!</p>`;
  body.querySelectorAll("[data-use]").forEach((b) => {
    b.onclick = async () => {
      const rw = REWARDS.find((x) => x.id === b.dataset.use);
      if (await confirmDlg(`「${rw.name}」を使う?あいてがそばにいるときに使ってね`, "使う!")) {
        await useReward(rw.id);
        render(screenEl);
      }
    };
  });
}

async function paintTimeline(body) {
  const items = await fetchPetLog(60);
  if (!items.length) { body.innerHTML = `<p class="dim center">まだ年表は空っぽ</p>`; return; }
  body.innerHTML = `<div class="tl">
    ${items.map((t) => `
      <div class="tl-item">
        <span class="tl-ico">${t.icon || "🐾"}</span>
        <div class="tl-txt">${esc(t.text)}<small>${fmtDateTimeJP(t.ts)}</small></div>
      </div>`).join("")}
  </div>`;
}


// =====================================================================
// ⑬ 週間ミッション
// =====================================================================
function paintMissions(body, screenEl) {
  const prog = weeklyProgress();
  const wk = weekKey().slice(1);
  body.innerHTML = `
    <p class="dim small center">${esc(wk)}の週 ・ 月曜0時に自動でリセット</p>
    ${MISSIONS.map((m) => {
      const cur = Math.min(prog[m.stat] || 0, m.target);
      const done = cur >= m.target;
      const claimed = !!prog[`claimed_${m.id}`];
      const rw = [m.reward.coins ? `🪙${m.reward.coins}` : "", m.reward.food ? `🍚${m.reward.food}` : ""].filter(Boolean).join(" ");
      return `<div class="rw-item ${claimed ? "used" : ""}">
        <span class="rw-ico">${m.icon}</span>
        <div class="rw-txt"><b>${esc(m.name)}</b>
          <div class="bar mis-bar"><i style="width:${(cur / m.target) * 100}%"></i></div>
          <small>${cur} / ${m.target} ・ ほうび ${rw}</small></div>
        ${claimed ? `<span class="chip ok">受取ずみ</span>`
          : done ? `<button class="btn btn-primary btn-sm" data-claim="${m.id}">うけとる</button>`
          : ""}
      </div>`;
    }).join("")}`;
  body.querySelectorAll("[data-claim]").forEach((b) => {
    b.onclick = async () => { await claimMission(b.dataset.claim); render(screenEl); };
  });
}

// =====================================================================
// ⑮ たいせんのきろく(ベストバウト)
// =====================================================================
async function paintMatches(body, screenEl) {
  const snap = await get(query(r("matchLog"), limitToLast(30)));
  const v = snap.val() || {};
  const items = Object.entries(v).map(([key, rec]) => ({ key, ...rec })).sort((a, b) => b.ts - a.ts);
  if (!items.length) { body.innerHTML = `<p class="dim center">対決をあそぶと、ここに記録が残るよ</p>`; return; }
  body.innerHTML = items.map((rec) => {
    const g = MATCH_GAMES[rec.gameId] || { icon: "🎮", name: rec.gameId };
    const line = matchLine(rec);
    return `<div class="rw-item">
      <span class="rw-ico">${g.icon}</span>
      <div class="rw-txt"><b>${esc(g.name)}</b><small>${fmtDateTimeJP(rec.ts)} ・ ${line}</small></div>
      <button class="btn btn-ghost btn-sm" data-replay="${rec.key}">みる</button>
      <button class="btn btn-ghost btn-sm" data-del="${rec.key}">🗑</button>
    </div>`;
  }).join("");
  body.querySelectorAll("[data-replay]").forEach((b) => {
    b.onclick = () => showReplay(items.find((x) => x.key === b.dataset.replay));
  });
  body.querySelectorAll("[data-del]").forEach((b) => {
    b.onclick = async () => {
      if (!(await confirmDlg("この記録をけす？", "けす"))) return;
      await remove(r(`matchLog/${b.dataset.del}`));
      render(screenEl);
    };
  });
}

function matchLine(rec) {
  const d = rec.detail || {};
  if (d.kind === "coop") return `💞×${d.matches || 0}`;
  if (d.winner) return `${esc(personOf(d.winner).name)}の勝ち`;
  if (d.scores) {
    const parts = Object.entries(d.scores).map(([uid, n]) => `${personOf(uid).emoji}${n}`);
    return parts.join(" - ") || "きろく";
  }
  return "きろく";
}

/** リプレイ表示: ラウンドごとの中身をふりかえる */
function showReplay(rec) {
  const d = rec.detail || {};
  const g = MATCH_GAMES[rec.gameId] || { icon: "🎮", name: rec.gameId };
  let html = "";
  if (rec.gameId === "wordmatch" && d.rounds) {
    html = d.rounds.map((x, i) => `
      <div class="ans-view" style="--pc:${x.hit ? "var(--leaf)" : "var(--latte)"}">
        <small>おだい${i + 1}: ${esc(x.t || "")} ${x.hit ? "💞" : ""}</small>
        <p>${Object.entries(x.w || {}).map(([uid, w]) =>
          `<b style="color:${personOf(uid).color}">${esc(personOf(uid).name)}</b>「${esc(w)}」`).join(" / ")}</p>
      </div>`).join("");
  } else if (rec.gameId === "guess" && d.log) {
    html = `<p class="center">こたえは <b>${d.answer}</b></p>` + d.log.map((gg) => `
      <div class="ans-view" style="--pc:${personOf(gg.uid).color}">
        <small>${esc(personOf(gg.uid).name)}</small><p>${gg.n} ${gg.hit ? "🎯" : ""}</p>
      </div>`).join("");
  } else if (rec.gameId === "coin" && d.log) {
    html = d.log.map((l, i) => `<div class="ans-view"><small>ラウンド${i + 1}</small>
      <p>${esc(JSON.stringify(l).slice(0, 60))}</p></div>`).join("");
    // コインはスコアだけの方が見やすい
    html = `<p class="center result-stars">${Object.entries(d.scores || {}).map(([uid, n]) =>
      `${personOf(uid).emoji}${n}`).join(" - ")}</p>`;
  } else if (d.scores) {
    html = `<p class="center result-stars">${Object.entries(d.scores).map(([uid, n]) =>
      `${personOf(uid).emoji}${n}`).join(" - ")}</p>${d.mode ? `<p class="center dim">${d.mode === "hard" ? "ハード" : "ノーマル"}</p>` : ""}`;
  } else if (d.winner) {
    html = `<p class="center">🏆 ${esc(personOf(d.winner).name)}の勝ち${d.loserCards != null ? `(のこり${d.loserCards}枚)` : ""}</p>`;
  } else {
    html = `<p class="dim center">くわしい記録はないみたい</p>`;
  }
  modal({ title: `${g.icon} ${g.name} ・ ${fmtDateJP(rec.ts)}`, body: html, cls: "m-wide",
    actions: [{ label: "とじる", cls: "btn-ghost" }] });
}

// =====================================================================
// ⑰ ふたりのじてん(図鑑+けんさく)
// =====================================================================
async function paintDex(body) {
  const dic = Object.values(S.shared?.dictionary || {}).sort((a, b) => b.ts - a.ts);
  const got = me()?.achievements || {};
  const achList = ACHIEVEMENTS.filter((a) => got[a.id]);
  const talkDone = QUESTIONS.filter((q) => {
    const t = S.talk?.[q.id];
    return t && Object.keys(t).length >= 2;
  });
  const logs = await fetchPetLog(40);

  const paint = (q = "") => {
    const hit = (txt) => !q || String(txt).toLowerCase().includes(q.toLowerCase());
    body.querySelector("#dex-body").innerHTML = `
      <h4>💞 つうじあった ことば(${dic.length})</h4>
      <div class="dex-words">${dic.filter((w) => hit(w.word) || hit(w.topic)).slice(0, 60)
        .map((w) => `<span class="gs-item" title="${esc(w.topic || "")}">${esc(w.word)}</span>`).join("") || `<p class="dim small">まだないよ</p>`}</div>
      <h4>🏆 じっせき(${achList.length})</h4>
      ${achList.filter((a) => hit(a.name) || hit(a.desc)).map((a) =>
        `<span class="gs-item">${a.icon} ${esc(a.name)}</span>`).join(" ") || `<p class="dim small">まだないよ</p>`}
      <h4>💬 みせあった質問(${talkDone.length})</h4>
      ${talkDone.filter((qq) => hit(qq.text)).slice(0, 40).map((qq) =>
        `<div class="ans-view"><p>${esc(qq.text)}</p></div>`).join("") || `<p class="dim small">まだないよ</p>`}
      <h4>🐾 できごと</h4>
      ${logs.filter((l) => hit(l.text)).slice(0, 30).map((l) =>
        `<div class="tl-item" style="margin-left:14px"><span>${l.icon}</span>
         <div class="tl-txt">${esc(l.text)}<small>${fmtDateJP(l.ts)}</small></div></div>`).join("")}`;
  };
  body.innerHTML = `
    <input class="txt-input" id="dex-q" placeholder="🔍 ことば・じっせき・質問をけんさく" style="margin-bottom:10px">
    <div id="dex-body"></div>`;
  paint();
  body.querySelector("#dex-q").addEventListener("input", (e) => paint(e.target.value.trim()));
}

// =====================================================================
// ⑯ 月間ふりかえりカード(画像で保存できる)
// =====================================================================
async function paintCard(body) {
  body.innerHTML = `<p class="dim center small">今月のあゆみを1枚のカードにするよ</p>
    <div class="center"><button class="btn btn-primary" id="mk-card">🖼️ カードを作る</button></div>
    <div id="card-out" class="center" style="margin-top:12px"></div>`;
  body.querySelector("#mk-card").onclick = async () => {
    const out = body.querySelector("#card-out");
    out.innerHTML = `<p class="dim">作成中…</p>`;
    try {
      const url = await buildMonthlyCard();
      out.innerHTML = `<img src="${url}" class="month-card" alt="ふりかえりカード">
        <p><a class="btn btn-primary btn-sm" href="${url}" download="hidamari-${todayKey()}.png">保存する</a></p>
        <p class="dim small">画像を長押しでも保存できるよ(SNSにもどうぞ)</p>`;
    } catch (e) {
      console.error(e);
      out.innerHTML = `<p class="dim">作成に失敗…もう一度ためしてね</p>`;
    }
  };
}
const todayKey = () => new Date().toISOString().slice(0, 7);

async function buildMonthlyCard() {
  const hist = await fetchHistory(400);
  const ym = todayKey();
  const inMonth = hist.filter((h) => new Date(h.ts).toISOString().slice(0, 7) === ym);
  const days = new Set(inMonth.map((h) => new Date(h.ts).toDateString())).size;
  const games = inMonth.filter((h) => h.type === "game").length;
  const feeds = inMonth.filter((h) => h.type === "feed").length;
  const pet = S.pet || {};

  const W = 900, H = 1125;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d");
  // 背景
  const bg = c.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#FDF3DC"); bg.addColorStop(1, "#F6E3C4");
  c.fillStyle = bg; c.fillRect(0, 0, W, H);
  c.fillStyle = "rgba(233,180,76,.25)";
  for (let i = 0; i < 24; i++) c.beginPath(), c.arc((i * 173) % W, (i * 271) % H, 6 + (i % 4) * 3, 0, 7), c.fill();
  // タイトル
  c.fillStyle = "#5C4B3A";
  c.font = "bold 54px 'Zen Maru Gothic', sans-serif"; c.textAlign = "center";
  c.fillText("ふたりのひだまり", W / 2, 110);
  c.font = "bold 40px 'Zen Maru Gothic', sans-serif";
  c.fillText(`${ym.replace("-", "年")}月の おもいで`, W / 2, 175);
  // ペット(SVG→画像化)
  const svg = renderPetSVG(pet, { expression: "happy" });
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res; img.onerror = rej;
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
  c.drawImage(img, W / 2 - 240, 210, 480, 406);
  // ステータス
  const rows = [
    [`🗓 あそんだ日`, `${days}日`], [`🎮 対決した回数`, `${games}回`],
    [`🍚 ごはんをあげた`, `${feeds}回`], [`🐣 ${pet.name || "ペット"}`, `Lv${pet.level || 1}`],
    [`💗 かけら累計`, `${S.shared?.heartsTotal || 0}こ`],
  ];
  c.font = "bold 34px 'Zen Maru Gothic', sans-serif";
  rows.forEach(([k, v], i) => {
    const y = 700 + i * 74;
    c.fillStyle = "rgba(255,253,248,.85)";
    roundRect(c, 90, y - 46, W - 180, 62, 20); c.fill();
    c.fillStyle = "#5C4B3A"; c.textAlign = "left"; c.fillText(k, 120, y);
    c.textAlign = "right"; c.fillText(v, W - 120, y);
  });
  c.textAlign = "center"; c.font = "26px 'Zen Maru Gothic', sans-serif";
  c.fillStyle = "#94826E"; c.fillText("Futari no Hidamari", W / 2, H - 46);
  return cv.toDataURL("image/png");
}
function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
