// =====================================================================
// セリフエンジン
// [状況] × [性格] × [あいての活動] から、いま言うべき一言を選ぶ。
// 将来 AI(Gemini) に差し替える場合も speak() の中身だけ変えればよい。
// =====================================================================
import { S, me, partner, partnerUid } from "../core/state.js";
import { APP } from "../config.js";
import { rand, hourNow, isSleepTime, dailyPick, todayStr } from "../core/ui.js";
import { DIALOGUE } from "../data/dialogues.js";
import { effHunger, moodOf, topAxis } from "./pet.js";
import { memoryLine, dreamLine } from "../core/memory.js";
import { boostToday } from "../core/economy.js";

/** プレースホルダを実名に置換 */
function fill(line) {
  return line
    .replaceAll("{you}", me()?.name || "きみ")
    .replaceAll("{partner}", partner()?.name || "あのこ")
    .replaceAll("{pet}", S.pet?.name || "ぼく");
}

/** あいてが今日すでに活動しているか(dailyノードで判定) */
function partnerActiveToday() {
  const p = partnerUid();
  return !!(p && S.dailyToday && S.dailyToday[p]);
}

/**
 * 状況に応じたセリフを1つ返す。
 * event を指定すると特定イベント("fed"/"petted"など)のセリフを返す。
 */
export function speak(event = null) {
  // 拗ねモード(ケンカ検知): ふたりとも3日以上来なかった直後は、まず拗ねる
  if (!event && sessionStorage.getItem("hdm_sulk") === "1") {
    sessionStorage.removeItem("hdm_sulk");
    return fill(rand(DIALOGUE.sulk));
  }
  // ねむり中は ときどき夢の寝言(記憶ベース)
  if (!event && isSleepTime() && Math.random() < 0.5) {
    const dm = dreamLine();
    if (dm) return fill(dm);
  }
  // 平常時は 25%で「記憶」から話す(この子は覚えている、の体験)
  if (!event && Math.random() < 0.25) {
    const ml = memoryLine();
    if (ml) return fill(ml);
  }
  const D = DIALOGUE;
  if (event && D[event]) return fill(rand(D[event]));

  const mood = moodOf();
  if (mood === "sleeping") return fill(rand(D.sleeping));
  if (boostToday() > 1) return fill(rand(D.anniversary));
  if (mood === "hungry") return fill(rand(D.hungry));
  if (mood === "lonely") return fill(rand(D.lonely));

  // 候補プールを組み立てて重み付き抽選
  const pool = [];
  const h = hourNow();
  const greet = h < 11 ? D.greetMorning : h < 18 ? D.greetDay : D.greetNight;
  pool.push(...greet, ...D.idle);
  if (partnerActiveToday()) pool.push(...D.partnerReport, ...D.partnerReport); // 重み2倍
  // 性格が10以上育っていたら口ぐせが混ざる
  const axis = topAxis();
  if ((S.pet?.personality?.[axis] || 0) >= 10) pool.push(...D.flavor[axis]);
  // きょうのおねだり(導線)
  pool.push(...wantLines());
  return fill(rand(pool));
}

/** きょうのおねだり対象 */
export function todaysWish() {
  return dailyPick(["wordmatch", "coin", "talk", "omoide", "kokoro"], 7);
}
function wantLines() {
  const w = todaysWish();
  return DIALOGUE.wants[w] || DIALOGUE.wantTalk;
}


// =====================================================================
// AIセリフ(㉒): Cloudflare Workers経由でGeminiに1文だけ作らせる。
// 未設定・エラー・遅延時はぜんぶ既存セリフのまま(フォールバック)。
// =====================================================================
export async function aiLine(situation = "idle") {
  const url = APP.ai?.workerUrl;
  if (!url) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3500);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        situation,                       // idle/morning/night/rain/birthday/levelup/evolve/full/hungry/aftergame/longtime
        pet: {
          name: S.pet?.name, level: S.pet?.level,
          form: S.pet?.form, mood: moodOf(), topAxis: topAxis(),
        },
        names: { you: me()?.name, partner: partner()?.name },
      }),
    });
    clearTimeout(timer);
    const j = await res.json();
    const t = String(j?.text || "").trim().slice(0, 60);
    return t || null;
  } catch {
    return null;  // 失敗 → 既存セリフへフォールバック
  }
}
