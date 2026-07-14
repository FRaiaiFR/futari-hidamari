// =====================================================================
// マスターデータ
// ★ 実績・ごほうび券・きせかえ・お題は、この配列に足すだけで追加できます。
//    (DBの変更やコード修正は不要)
// =====================================================================

// ---- いしんでんしんワードのお題 ----------------------------------------
export const TOPICS = [
  "あかいもの といえば？", "まるいもの といえば？", "あまい たべもの といえば？",
  "冬 といえば？", "夏 といえば？", "海 といえば？", "空 といえば？",
  "朝ごはんの定番 といえば？", "コンビニで買うもの といえば？",
  "動物園の人気者 といえば？", "水族館 といえば？", "お祭りの屋台 といえば？",
  "遠足のおやつ といえば？", "おでんの具 といえば？", "鍋の具 といえば？",
  "パンの種類 といえば？", "おにぎりの具 といえば？", "アイスの味 といえば？",
  "ジュース といえば？", "果物 といえば？", "野菜 といえば？",
  "白いもの といえば？", "黄色いもの といえば？", "ふわふわなもの といえば？",
  "つめたいもの といえば？", "あったかいもの といえば？",
  "学校にあるもの といえば？", "公園にあるもの といえば？",
  "台所にあるもの といえば？", "カバンに入ってるもの といえば？",
  "デート といえば？", "旅行に持っていくもの といえば？",
  "誕生日 といえば？", "クリスマス といえば？", "お正月 といえば？",
  "雨の日 といえば？", "夜 といえば？", "春 といえば？", "秋 といえば？",
  "テーマパーク といえば？", "映画館で買うもの といえば？",
  "ゲーム といえば？",
];

// ---- 称号 --------------------------------------------------------------
export const TITLES = {
  t_kaikin:   { name: "皆勤カップル" },
  t_hidamari: { name: "ひだまりの主" },
  t_nade:     { name: "なでなで職人" },
  t_sodate:   { name: "育ての親" },
  t_shinri:   { name: "心理戦マスター" },
  t_ishin:    { name: "いしんでんしん" },
  t_hanaseru: { name: "なんでも話せる仲" },
  t_josho:    { name: "常勝" },
};

// ---- 実績 --------------------------------------------------------------
// cond(ctx) … ctx = { u: 自分のデータ, pet, shared, users }
// reward   … { coins, food, hearts, title } の組み合わせ
const st = (u, k) => (u.stats?.[k] || 0);

export const ACHIEVEMENTS = [
  { id: "first_login", name: "はじめまして", icon: "🌱", desc: "はじめてひだまりに来た",
    cond: () => true, reward: { coins: 20 } },
  { id: "both_day1", name: "ふたりの一歩", icon: "👫", desc: "はじめて2人が同じ日にあそんだ",
    cond: (c) => (c.shared?.heartsTotal || 0) >= 1, reward: { coins: 30 } },
  { id: "feed_1", name: "はじめてのごはん", icon: "🍚", desc: "はじめてごはんをあげた",
    cond: (c) => st(c.u, "feedCount") >= 1, reward: { coins: 10 } },
  { id: "feed_50", name: "ごはん名人", icon: "🍳", desc: "ごはんを50回あげた",
    cond: (c) => st(c.u, "feedCount") >= 50, reward: { coins: 100 } },
  { id: "pet_100", name: "なでなで100回", icon: "🫶", desc: "100回なでた",
    cond: (c) => st(c.u, "petCount") >= 100, reward: { coins: 80, title: "t_nade" } },
  { id: "streak_7", name: "まいにちのしゅうかん", icon: "📅", desc: "7日連続ログイン",
    cond: (c) => (c.u.loginStreak || 0) >= 7, reward: { coins: 50, food: 2 } },
  { id: "streak_30", name: "かかさず30日", icon: "🗓️", desc: "30日連続ログイン",
    cond: (c) => (c.u.loginStreak || 0) >= 30, reward: { coins: 200, title: "t_kaikin" } },
  { id: "streak_100", name: "100日のきずな", icon: "💯", desc: "100日連続ログイン",
    cond: (c) => (c.u.loginStreak || 0) >= 100, reward: { coins: 500, title: "t_hidamari" } },
  { id: "lv10", name: "すくすく成長", icon: "🐣", desc: "ペットがLv10になった",
    cond: (c) => (c.pet?.level || 0) >= 10, reward: { coins: 50 } },
  { id: "lv25", name: "りっぱなおとな", icon: "🎓", desc: "ペットがLv25になった",
    cond: (c) => (c.pet?.level || 0) >= 25, reward: { coins: 150 } },
  { id: "lv50", name: "とくべつな進化", icon: "✨", desc: "ペットがLv50で特別進化した",
    cond: (c) => (c.pet?.level || 0) >= 50, reward: { hearts: 5, title: "t_sodate" } },
  { id: "win_1", name: "はじめての勝利", icon: "🏆", desc: "対決ではじめて勝った",
    cond: (c) => st(c.u, "wins") >= 1, reward: { coins: 30 } },
  { id: "win_10", name: "10勝とっぱ", icon: "🥉", desc: "対決で10勝した",
    cond: (c) => st(c.u, "wins") >= 10, reward: { coins: 50 } },
  { id: "win_50", name: "50勝とっぱ", icon: "🥈", desc: "対決で50勝した",
    cond: (c) => st(c.u, "wins") >= 50, reward: { coins: 200 } },
  { id: "win_100", name: "100勝とっぱ", icon: "🥇", desc: "対決で100勝した",
    cond: (c) => st(c.u, "wins") >= 100, reward: { coins: 500, title: "t_josho" } },
  { id: "wstreak_5", name: "5連勝", icon: "🔥", desc: "対決で5連勝した",
    cond: (c) => st(c.u, "maxWinStreak") >= 5, reward: { coins: 80, title: "t_shinri" } },
  { id: "match_30", name: "つうじあう心", icon: "💞", desc: "ワードを合計30回一致させた",
    cond: (c) => st(c.u, "wordMatchTotal") >= 30, reward: { coins: 120, title: "t_ishin" } },
  { id: "talk_10", name: "おしゃべり好き", icon: "💬", desc: "質問に10回こたえた",
    cond: (c) => st(c.u, "talkCount") >= 10, reward: { coins: 50 } },
  { id: "talk_50", name: "話は尽きない", icon: "🗣️", desc: "質問に50回こたえた",
    cond: (c) => st(c.u, "talkCount") >= 50, reward: { coins: 200, title: "t_hanaseru" } },
  { id: "night_1", name: "よふかしさん", icon: "🌙", desc: "23時〜4時にあそんだ",
    cond: (c) => st(c.u, "nightPlays") >= 1, reward: { coins: 20 } },
  { id: "anniv_1", name: "記念日デート", icon: "🎂", desc: "記念日にあそんだ",
    cond: (c) => st(c.u, "annivPlays") >= 1, reward: { hearts: 3 } },
  { id: "all_games", name: "全ゲームせいは", icon: "🎮", desc: "すべての対決ゲームをあそんだ",
    cond: (c) => (c.u.stats?.byGame?.wordmatch?.played || 0) > 0 && (c.u.stats?.byGame?.coin?.played || 0) > 0,
    reward: { coins: 60 } },
  { id: "dress_1", name: "おしゃれさん", icon: "🎀", desc: "はじめてきせかえを買った",
    cond: (c) => st(c.u, "buyCount") >= 1, reward: { coins: 30 } },
  { id: "hearts_10", name: "ハートあつめ", icon: "💗", desc: "ハートのかけらを合計10こ集めた",
    cond: (c) => (c.shared?.heartsTotal || 0) >= 10, reward: { coins: 100 } },

  // ---- ふたりで解除する協力実績(⑭)。条件は2人共通なので同時に解除される ----
  { id: "pair_100days", pair: true, name: "いっしょに100日", icon: "🗓️", desc: "2人そろった日が合計100日",
    cond: (c) => (c.shared?.heartsTotal || 0) >= 100, reward: { coins: 300, hearts: 10 } },
  { id: "pair_coop50", pair: true, name: "協力プレイ50回", icon: "🤝", desc: "2人の対決あそび回数が合計50回",
    cond: (c) => Object.values(c.users || {}).reduce((n, u) =>
      n + Object.values(u?.stats?.byGame || {}).reduce((m, g) => m + (g.played || 0), 0), 0) >= 50,
    reward: { coins: 250 } },
  { id: "pair_words100", pair: true, name: "ことばの交換100", icon: "📖", desc: "いしんでんしんの回答交換が合計100回",
    cond: (c) => Object.values(c.users || {}).reduce((n, u) => n + (u?.stats?.wordMatchTotal || 0), 0) >= 100,
    reward: { coins: 300, hearts: 5 } },
];

// ---- ごほうび券(現実のごほうびと交換できる券) ---------------------------
export const REWARDS = [
  { id: "rw_drink", name: "ドリンク券", icon: "🧋", desc: "あいてに好きな飲み物を1杯おごってもらえる",
    condDesc: "対決で10勝", cond: (c) => st(c.u, "wins") >= 10 },
  { id: "rw_kata", name: "かたたたき券", icon: "💆", desc: "あいてに5分間マッサージしてもらえる",
    condDesc: "対決で20勝", cond: (c) => st(c.u, "wins") >= 20 },
  { id: "rw_sweets", name: "スイーツ券", icon: "🍰", desc: "あいてとスイーツを食べに行ける(あいてのおごり)",
    condDesc: "対決で30勝", cond: (c) => st(c.u, "wins") >= 30 },
  { id: "rw_movie", name: "映画デート券", icon: "🎬", desc: "見たい映画をあいてと見に行ける",
    condDesc: "対決で50勝", cond: (c) => st(c.u, "wins") >= 50 },
  { id: "rw_gohan", name: "ごはんリクエスト券", icon: "🍽️", desc: "食べたいものをあいてにリクエストできる",
    condDesc: "質問に30回こたえる", cond: (c) => st(c.u, "talkCount") >= 30 },
  { id: "rw_odekake", name: "おでかけ計画券", icon: "🗺️", desc: "行きたい場所へのデートを計画してもらえる",
    condDesc: "14日連続ログイン", cond: (c) => (c.u.loginStreak || 0) >= 14 },
  { id: "rw_nandemo", name: "なんでもおねがい券", icon: "🌟", desc: "むりのない範囲で、なんでも1つおねがいできる",
    condDesc: "ハートのかけらを合計30こ", cond: (c) => (c.shared?.heartsTotal || 0) >= 30 },
];

// ---- きせかえ(アクセサリー) --------------------------------------------
// price は { coins } か { hearts }。SVG本体は pet/petView.js 側にある。
export const ACCESSORIES = [
  { id: "ribbon",   name: "りぼん",         slot: "head", icon: "🎀", price: { coins: 100 } },
  { id: "strawhat", name: "むぎわらぼうし", slot: "head", icon: "👒", price: { coins: 150 } },
  { id: "glasses",  name: "まるめがね",     slot: "face", icon: "👓", price: { coins: 120 } },
  { id: "bowtie",   name: "ちょうネクタイ", slot: "neck", icon: "🎩", price: { coins: 80 } },
  { id: "scarf",    name: "マフラー",       slot: "neck", icon: "🧣", price: { coins: 200 } },
  { id: "crown",    name: "おうかん",       slot: "head", icon: "👑", price: { hearts: 20 } },
  { id: "halo",     name: "てんしのわ",     slot: "head", icon: "😇", price: { hearts: 40 } },
];

export const SLOT_NAMES = { head: "あたま", face: "かお", neck: "くび" };

// ---- 性格(4軸) ----------------------------------------------------------
export const PERSONALITY = {
  amae:      { name: "あまえんぼ",  icon: "🍼", desc: "なでたり、まいにち会いに来ると育つ" },
  yuukan:    { name: "ゆうかん",    icon: "⚔️", desc: "コイン対決であそぶと育つ" },
  nakayoshi: { name: "なかよし",    icon: "💞", desc: "ワードを一致させたり、2人でそろうと育つ" },
  monoshiri: { name: "ものしり",    icon: "📚", desc: "質問にこたえると育つ" },
};
