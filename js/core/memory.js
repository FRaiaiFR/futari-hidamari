// =====================================================================
// きおくシステム(記憶を持つ生き物)
// ・ふたりの「事実」を既存データ(talk/config/shared/stats)から収集
// ・口癖: ふたりがよく使う言葉を shared/kotoba に蓄積(遺伝の素)
// ・セリフ/夢/思い出クイズは全部ここの facts を素材にする
// =====================================================================
import { S, personOf, partnerUid, me } from "./state.js";
import { tx } from "./firebase.js";
import { QUESTIONS } from "../data/questions.js";
import { fmtDateJP } from "./ui.js";

const STOP = new Set(["こと", "もの", "それ", "これ", "ある", "する", "です", "ます", "かな", "とか"]);

/** 口癖の学習: 送信された言葉を数える(2〜8文字の言葉のみ) */
export async function learnWord(text) {
  const w = String(text || "").trim();
  if (w.length < 2 || w.length > 8 || STOP.has(w)) return;
  await tx(`shared/kotoba/${encodeURIComponent(w).replace(/[.#$/\[\]%]/g, "_")}`,
    (v) => ({ w, n: ((v && v.n) || 0) + 1 })).catch(() => {});
}

/** よく使う言葉 上位n件 */
export function topWords(n = 5) {
  return Object.values(S.shared?.kotoba || {})
    .filter((x) => x && x.w && x.n >= 2)
    .sort((a, b) => b.n - a.n).slice(0, n).map((x) => x.w);
}

/** ふたりの「事実」を集める。セリフ・夢・クイズの共通素材。 */
export function collectFacts() {
  const facts = [];
  const meP = me(); const pu = partnerUid();
  const paName = personOf(pu).name, myName = personOf(S.uid).name;

  // 1) はなすの回答(両者分)
  for (const [qid, ans] of Object.entries(S.talk || {})) {
    const q = QUESTIONS.find((x) => x.id === qid);
    if (!q || !ans) continue;
    for (const [uid, a] of Object.entries(ans)) {
      const text = typeof a === "object" ? a?.text : a;
      if (!text) continue;
      facts.push({
        kind: "answer", uid, who: personOf(uid).name,
        q: q.text, a: String(text).slice(0, 30),
      });
    }
  }
  // 2) 記念日・誕生日
  const ann = S.config?.anniversary;
  if (ann) {
    const days = Math.floor((Date.now() - new Date(ann).getTime()) / 86400000);
    if (days > 0) facts.push({ kind: "anniv", days, date: ann });
  }
  for (const [key, d] of Object.entries(S.config?.birthdays || {})) {
    facts.push({ kind: "bday", key, date: d });
  }
  // 3) 通じあった言葉
  const dic = Object.values(S.shared?.dictionary || {});
  for (const w of dic.slice(-20)) {
    if (w?.word) facts.push({ kind: "word", word: w.word, topic: w.topic || "", ts: w.ts });
  }
  // 4) 口癖
  for (const w of topWords(4)) facts.push({ kind: "kuchiguse", word: w });
  // 5) 数字の事実(クイズ用)
  facts.push({ kind: "stat", label: "そろった日の合計", value: S.shared?.heartsTotal || 0, unit: "日" });
  facts.push({ kind: "stat", label: "つうじあった ことばの数", value: dic.length, unit: "こ" });
  if (S.pet) facts.push({ kind: "stat", label: `${S.pet.name}のレベル`, value: S.pet.level || 1, unit: "" });
  return facts;
}

/** 記憶にもとづくセリフを1つ(なければnull) */
export function memoryLine() {
  const facts = collectFacts();
  const cands = [];
  for (const f of facts) {
    if (f.kind === "answer") cands.push(`そういえば ${f.who}、「${f.a}」っていってたよね`);
    if (f.kind === "word") cands.push(`「${f.word}」…ふたりの ことば、おぼえてるよ`);
    if (f.kind === "kuchiguse") cands.push(`「${f.word}」って、ふたりよくいうよね。うつっちゃった`);
    if (f.kind === "anniv" && f.days % 10 === 0) cands.push(`きょうで ふたりは ${f.days}日め なんだって!`);
  }
  if (!cands.length) return null;
  return cands[Math.floor(Math.random() * cands.length)];
}

/** ペットの夢(深夜/睡眠中にタップすると漏れる寝言) */
export function dreamLine() {
  const facts = collectFacts().filter((f) => f.kind === "answer" || f.kind === "word");
  if (!facts.length) return "むにゃ…ひだまり…あったかい…";
  const f = facts[Math.floor(Math.random() * facts.length)];
  return f.kind === "word"
    ? `むにゃ…「${f.word}」…えへへ…`
    : `すぅ…${f.who}…「${f.a}」…って…むにゃ`;
}

/** 思い出クイズの問題を生成(4択)。履歴とペットから自動出題。 */
export function buildQuizPool() {
  const pool = [];
  const facts = collectFacts();
  const dic = facts.filter((f) => f.kind === "word");
  const stats = facts.filter((f) => f.kind === "stat");
  const answers = facts.filter((f) => f.kind === "answer");

  // 数値系: 正解±ばらし選択肢
  for (const st of stats) {
    const v = st.value;
    const opts = new Set([v]);
    while (opts.size < 4) opts.add(Math.max(0, v + Math.floor(Math.random() * 7) - 3 || opts.size));
    pool.push({ q: `${st.label}は?`, opts: [...opts].sort(() => Math.random() - .5).map((x) => `${x}${st.unit}`), ans: `${v}${st.unit}` });
  }
  // ことば系: このお題で通じあった言葉は?
  for (const w of dic.slice(-8)) {
    if (!w.topic) continue;
    const others = dic.filter((x) => x.word !== w.word).map((x) => x.word);
    if (others.length < 3) continue;
    const opts = [w.word, ...others.sort(() => Math.random() - .5).slice(0, 3)].sort(() => Math.random() - .5);
    pool.push({ q: `「${w.topic}」で そろった ことばは?`, opts, ans: w.word });
  }
  // 回答系: この質問に◯◯はなんて答えた?
  for (const a of answers.slice(-10)) {
    const others = answers.filter((x) => x.a !== a.a).map((x) => x.a);
    if (others.length < 3) continue;
    const opts = [a.a, ...others.sort(() => Math.random() - .5).slice(0, 3)].sort(() => Math.random() - .5);
    pool.push({ q: `「${a.q}」に ${a.who}は?`, opts, ans: a.a });
  }
  return pool;
}

/** 世界に1匹証明書: 個体No(名前+誕生時刻から決定的に生成) */
export function petCertNo(pet) {
  const src = `${pet?.bornAt || 0}|${pet?.name || ""}|hidamari`;
  let h = 2166136261;
  for (const c of src) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  const n = (h >>> 0).toString(36).toUpperCase().padStart(7, "0").slice(0, 7);
  return `HDM-${n.slice(0, 3)}-${n.slice(3)}`;
}
