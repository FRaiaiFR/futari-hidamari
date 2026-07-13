// =====================================================================
// ペットエンジン
// レベル・進化・満腹度(遅延計算)・性格・お世話アクション。
// 共有データなので、更新はすべてトランザクション経由。
// =====================================================================
import { tx, r, get, set } from "../core/firebase.js";
import { S, me, partner, emit } from "../core/state.js";
import { APP } from "../config.js";
import { todayStr, isSleepTime, toast, confetti, vibrate } from "../core/ui.js";
import { boostToday, bumpStat } from "../core/economy.js";
import { logH, petLog } from "../core/history.js";
import { checkAll } from "../core/achievements.js";
import { FORMS } from "../data/dialogues.js";

export const PETS_PER_DAY = 20;      // 1人1日のなでなで有効回数
const HUNGER_DECAY_PER_H = 4;        // 満腹度の自然減少 / 時
const FEED_RECOVER = 30;             // ごはん1回の回復量

/** レベル l から次のレベルに必要な経験値 */
export const expNeed = (l) => 40 + l * 20;

/** レベル → 進化段階 */
export function stageForLevel(l) {
  if (l < 2) return "egg";
  if (l < 10) return "baby";
  if (l < 25) return "kids";
  if (l < 50) return "adult";
  return "special";
}
export const STAGE_NAMES = {
  egg: "たまご", baby: "ベビー", kids: "キッズ", adult: "アダルト", special: "とくべつ",
};

/** 現在の満腹度(保存値から経過時間ぶん減らして算出) */
export function effHunger(pet = S.pet) {
  if (!pet) return 0;
  const hours = (Date.now() - (pet.hungerTs || Date.now())) / 3600000;
  return Math.max(0, Math.min(100, Math.round((pet.hunger ?? 70) - hours * HUNGER_DECAY_PER_H)));
}

/** 気分の判定 */
export function moodOf(pet = S.pet) {
  if (!pet) return "normal";
  if (isSleepTime()) return "sleeping";
  const h = effHunger(pet);
  if (h < 25) return "hungry";
  const last = pet.lastCareDate || "";
  const days = last ? Math.floor((Date.now() - new Date(last + "T00:00").getTime()) / 86400000) : 99;
  if (days >= 2) return "lonely";
  if (h >= 60 && last === todayStr()) return "happy";
  return "normal";
}
export const MOOD_ICONS = {
  sleeping: "💤", hungry: "🍚", lonely: "🥺", happy: "😊", normal: "🙂",
};

/** 性格の最高軸 */
export function topAxis(p = S.pet?.personality) {
  if (!p) return "nakayoshi";
  return Object.entries({ amae: 0, yuukan: 0, nakayoshi: 0, monoshiri: 0, ...p })
    .sort((a, b) => b[1] - a[1])[0][0];
}

/** 初回起動時にペットを生成 */
export async function ensurePet() {
  const snap = await get(r("pet"));
  if (snap.exists()) return;
  await set(r("pet"), {
    name: APP.defaultPetName,
    level: 1, exp: 0,
    hunger: 80, hungerTs: Date.now(),
    personality: { amae: 0, yuukan: 0, nakayoshi: 0, monoshiri: 0 },
    equipped: {}, form: null,
    petsToday: { date: todayStr() },
    lastCareDate: todayStr(),
    bornAt: Date.now(),
  });
  await petLog(`${APP.defaultPetName}のたまごが ひだまりにやってきた`, "🥚");
}

/**
 * 経験値を与える(記念日ブースト込み)。
 * レベルアップ・特別進化の判定と演出もここで行う。
 */
export async function gainExp(n, reason = "") {
  const amount = Math.round(n * boostToday());
  let leveledTo = 0;
  let newForm = null;
  const res = await tx("pet", (p) => {
    if (!p) return false;
    p.exp = (p.exp || 0) + amount;
    while (p.exp >= expNeed(p.level)) {
      p.exp -= expNeed(p.level);
      p.level += 1;
      leveledTo = p.level;
      // Lv50到達の瞬間、その時の最高性格で「かたち」が確定する
      if (p.level === 50 && !p.form) {
        p.form = topAxis(p.personality);
        newForm = p.form;
      }
    }
    return p;
  });
  if (!res.committed) return;
  if (leveledTo) {
    const name = S.pet?.name || APP.defaultPetName;
    toast(`${name}が Lv${leveledTo} になった！`, "🎉");
    confetti(30);
    vibrate(30);
    petLog(`Lv${leveledTo}になった！${reason ? `(${reason})` : ""}`, "⬆️");
    if (leveledTo === 2) petLog("たまごから かえった！", "🐣");
    if (leveledTo === 10) petLog("キッズに進化した！", "🌟");
    if (leveledTo === 25) petLog("アダルトに進化した！", "🌟");
    if (newForm) petLog(`とくべつ進化！「${FORMS[newForm].name}」になった！`, FORMS[newForm].icon);
    emit("pet:levelup", leveledTo);
    checkAll();
  }
}

/** 性格の軸を伸ばす */
export function addPersonality(axis, n = 1) {
  return tx(`pet/personality/${axis}`, (v) => (v || 0) + n);
}

/** ごはんをあげる */
export async function feed() {
  if (!S.pet) return;
  if (effHunger() >= 100) { toast("おなかいっぱいみたい", "😋"); return; }
  // 自分のごはんを1つ消費(なければ中断)
  const paid = await tx(`users/${S.uid}/food`, (f) => ((f || 0) >= 1 ? f - 1 : false));
  if (!paid.committed) {
    toast("ごはんがないよ。ログインや「はなす」でもらえるよ", "🍚");
    return;
  }
  await tx("pet", (p) => {
    if (!p) return false;
    const hours = (Date.now() - (p.hungerTs || Date.now())) / 3600000;
    const cur = Math.max(0, Math.min(100, (p.hunger ?? 70) - hours * HUNGER_DECAY_PER_H));
    p.hunger = Math.min(100, Math.round(cur + FEED_RECOVER));
    p.hungerTs = Date.now();
    p.lastCareDate = todayStr();
    return p;
  });
  vibrate();
  await bumpStat("feedCount");
  await gainExp(8, "ごはん");
  await addPersonality("amae", 1);
  logH("feed");
  emit("pet:fed");
  checkAll();
}

/**
 * なでる。1人1日 PETS_PER_DAY 回まで経験値がもらえる。
 * 戻り値: {capped} … 上限超過かどうか
 */
export async function petPet() {
  if (!S.pet) return { capped: true };
  let capped = false;
  await tx("pet", (p) => {
    if (!p) return false;
    const t = todayStr();
    if (!p.petsToday || p.petsToday.date !== t) p.petsToday = { date: t };
    const c = p.petsToday[S.uid] || 0;
    if (c >= PETS_PER_DAY) { capped = true; return p; }
    p.petsToday[S.uid] = c + 1;
    p.lastCareDate = t;
    return p;
  });
  vibrate(8);
  if (!capped) {
    await bumpStat("petCount");
    await addPersonality("amae", 1);
    await gainExp(2, "なでなで");
    logH("pet");
    checkAll();
  }
  emit("pet:petted", { capped });
  return { capped };
}

/** きせかえの装備を切り替え(null で外す) */
export function equip(slot, accId) {
  return tx(`pet/equipped`, (eq) => {
    eq = eq || {};
    if (accId) eq[slot] = accId; else delete eq[slot];
    return eq;
  });
}

/** ペットの名前を変える */
export async function renamePet(name) {
  const clean = String(name || "").trim().slice(0, 10);
  if (!clean) return false;
  await tx("pet/name", () => clean);
  await petLog(`「${clean}」という名前をもらった`, "📛");
  return true;
}
