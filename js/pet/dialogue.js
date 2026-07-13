// =====================================================================
// セリフエンジン
// [状況] × [性格] × [あいての活動] から、いま言うべき一言を選ぶ。
// 将来 AI(Gemini) に差し替える場合も speak() の中身だけ変えればよい。
// =====================================================================
import { S, me, partner, partnerUid } from "../core/state.js";
import { rand, hourNow, isSleepTime, dailyPick, todayStr } from "../core/ui.js";
import { DIALOGUE } from "../data/dialogues.js";
import { effHunger, moodOf, topAxis } from "./pet.js";
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
  return dailyPick(["wordmatch", "coin", "talk", "memory", "guess", "uno"], 7);
}
function wantLines() {
  const w = todaysWish();
  return DIALOGUE.wants[w] || DIALOGUE.wantTalk;
}
