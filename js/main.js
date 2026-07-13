// =====================================================================
// エントリポイント
// 起動 → ログイン確認 → DB購読 → 日次処理(ログインボーナス・ハート) → 画面表示
// =====================================================================
import { PARTNERS, APP } from "./config.js";
import { auth, r, tx, onValue, onAuthStateChanged } from "./core/firebase.js";
import { S, emit, partnerUid } from "./core/state.js";
import { applyTheme, todayStr, yesterdayStr, hourNow, toast } from "./core/ui.js";
import { renderLogin } from "./core/auth.js";
import { initRouter, refresh } from "./core/router.js";
import { initPresence } from "./core/presence.js";
import { ensurePet } from "./pet/pet.js";
import { addHearts, addFood, addCoins, bumpStat, boostToday } from "./core/economy.js";
import { checkAll } from "./core/achievements.js";
import { register, handleMatchChange, cleanupDead } from "./core/match.js";
import { logH } from "./core/history.js";
import wordmatch from "./games/wordmatch.js";
import coin from "./games/coin.js";
import memory from "./games/memory.js";
import guess from "./games/guess.js";
import uno from "./games/uno.js";

// ---- ゲームを対戦基盤に登録(新ゲームはここに1行足すだけ) ----
register(wordmatch);
register(coin);
register(memory);
register(guess);
register(uno);

// ---- スマホ誤操作ガード(ピンチズーム禁止。タップ操作には影響しない) ----
for (const ev of ["gesturestart", "gesturechange", "gestureend"]) {
  document.addEventListener(ev, (e) => e.preventDefault());   // iOS Safariのピンチ
}

// ---- テーマ(夜は自動で室内灯モード)。1分ごとに再評価 ----
applyTheme();
setInterval(applyTheme, 60 * 1000);

// ---- 認証状態で分岐 ----
const root = document.getElementById("app");
let booted = false;

onAuthStateChanged(auth, (user) => {
  if (!user) { renderLogin(root); booted = false; return; }
  if (booted) return; // リスナー多重登録防止
  booted = true;
  init(user).catch((e) => {
    console.error(e);
    root.innerHTML = `<div class="boot"><p>起動に失敗しました…<br>
      <small>${String(e.message || e)}</small><br>
      config.js の設定と SETUP.md を確認してね</p></div>`;
  });
});

// =====================================================================
// 初期化
// =====================================================================
async function init(user) {
  S.uid = user.uid;

  // profileKey をメールアドレスから確定(ログイン画面の選択に依存しない)
  const email = (user.email || "").toLowerCase();
  const def = PARTNERS.find((p) => p.email.toLowerCase() === email) || PARTNERS[0];
  S.meKey = def.key;

  // 自分のプロフィールを用意(初回のみ生成、以降は既存値を維持)
  await tx(`users/${S.uid}`, (u) => {
    if (u) return undefined; // 既にある → 変更なし(draft書込しない)
    return {
      name: def.name, profileKey: def.key,
      coins: 0, food: 3, loginStreak: 0, lastLogin: "",
      equippedTitle: null,
      stats: {}, achievements: {}, titles: {}, rewards: {},
      joinedAt: Date.now(),
    };
  });

  // ペットの初期生成(未生成のときだけ)
  await ensurePet();

  // ---- DB購読(S を更新して画面を再描画) ----
  const today = todayStr();
  let gotUsers = false, gotPet = false, gotShared = false;

  onValue(r("users"), (s) => {
    S.users = s.val() || {};
    gotUsers = true; readyCheck();
    refresh(); emit("users:change");
  });
  onValue(r("pet"), (s) => {
    S.pet = s.val();
    gotPet = true; readyCheck();
    refresh(); emit("pet:change");
  });
  onValue(r("shared"), (s) => {
    S.shared = s.val() || {};
    gotShared = true; readyCheck();
    refresh();
  });
  onValue(r("config"), (s) => { S.config = s.val() || {}; refresh(); });
  onValue(r("talk"), (s) => {
    S.talk = s.val() || {};
    refresh();
    emit("talk:change"); // 「あいて待ち」モーダルの自動切替に使う
  });
  attachDaily(today);
  onValue(r("presence"), (s) => { S.presence = s.val() || {}; refresh(); });
  onValue(r("match"), (s) => {
    S.match = s.val();
    handleMatchChange();
  });

  function readyCheck() {
    if (S.ready || !(gotUsers && gotPet && gotShared)) return;
    S.ready = true;
    initRouter(root);       // 起動画面を置き換えて本編へ
    afterBoot();            // 日次処理は画面表示後に(体感速度優先)
  }

  initPresence();
  cleanupDead(); // 放置された古い対戦を掃除
  watchDateChange(); // 0時をまたいだら自動でお題・ボーナスを更新
}

// ---- daily/{日付} の購読(日付が変わったら張り替える) ----
let unsubDaily = null;
function attachDaily(date) {
  if (unsubDaily) { try { unsubDaily(); } catch { /* noop */ } }
  unsubDaily = onValue(r(`daily/${date}`), (s) => {
    S.dailyToday = s.val() || {};
    refresh();
    grantHeartIfBoth(); // 両者そろったらハート付与(冪等)
  });
}

// ---- 0時またぎの監視(30秒ごとに日付を確認) ----
// アプリを開きっぱなしでも、日付が変わった瞬間に
// きょうのお題・きょうの1問・ログインボーナス・テーマが自動で切り替わる。
function watchDateChange() {
  let curDay = todayStr();
  setInterval(() => {
    if (todayStr() === curDay) return;
    curDay = todayStr();
    attachDaily(curDay);   // きょうの活動フラグの購読先を新しい日へ
    applyTheme();
    afterBoot();           // 新しい日のログインボーナス・活動フラグ(冪等)
    refresh();             // 画面再描画 → 「はなす」のお題が入れかわる
    emit("talk:change");   // 開いているモーダルにも日付変更を通知
  }, 30 * 1000);
}

// =====================================================================
// 起動後の日次処理
// =====================================================================
async function afterBoot() {
  const today = todayStr();

  // ---- ログインボーナス(1日1回) ----
  const res = await tx(`users/${S.uid}`, (u) => {
    if (!u || u.lastLogin === today) return false;
    u.loginStreak = u.lastLogin === yesterdayStr() ? (u.loginStreak || 0) + 1 : 1;
    u.lastLogin = today;
    return u;
  });
  if (res.committed) {
    const u = res.snapshot.val();
    await addFood(1);
    let msg = `ログインボーナス! 🍚+1(${u.loginStreak}日目)`;
    if (u.loginStreak % 7 === 0) {
      await addFood(2); await addCoins(20);
      msg = `${u.loginStreak}日連続! 🍚+3 🪙+20 すごい!`;
    }
    toast(msg, "🎁");
    logH("login", { streak: u.loginStreak });
  }

  // ---- 今日の活動フラグ(ハートのかけら判定の材料) ----
  await tx(`daily/${today}/${S.uid}`, () => true);

  // ---- 深夜プレイ / 記念日プレイの統計(実績用・1日1回) ----
  const h = hourNow();
  if (h >= 23 || h < 4) {
    const g = await tx(`daily/${today}/night_${S.uid}`, (v) => (v ? false : true));
    if (g.committed) bumpStat("nightPlays");
  }
  if (boostToday() > 1) {
    const g = await tx(`daily/${today}/anniv_${S.uid}`, (v) => (v ? false : true));
    if (g.committed) bumpStat("annivPlays");
  }

  grantHeartIfBoth();
  checkAll();
}

// ---- 2人が同じ日にあそんだら 💗+1(トランザクションで1回だけ) ----
async function grantHeartIfBoth() {
  const d = S.dailyToday;
  const pu = partnerUid();
  if (!d || !pu || !d[S.uid] || !d[pu] || d.heartGranted) return;
  const res = await tx(`daily/${todayStr()}/heartGranted`, (v) => (v ? false : true));
  if (res.committed) {
    await addHearts(1);
    toast("きょうは2人そろった! 💗のかけら+1", "💗");
    logH("heart", {});
    checkAll();
  }
}

console.log(`ふたりのひだまり v${APP.version}`);
