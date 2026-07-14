// =====================================================================
// 家具ショップ マスターデータ
// slot(置き場所)ごとに1つ装備できる。★追加は配列に1オブジェクト足すだけ。
// pos は部屋(.room)の中での配置スタイル。
// =====================================================================
export const FURN_SLOTS = {
  bed:    { name: "ベッド",     pos: "left:12px;  bottom:20px; font-size:34px;" },
  rug:    { name: "ラグ",       pos: "" },                                        // ラグは色替え(特別扱い)
  plant:  { name: "かんようしょくぶつ", pos: "right:18px; bottom:24px; font-size:30px;" },
  clock:  { name: "とけい",     pos: "left:50%; top:14px; transform:translateX(-50%); font-size:22px;" },
  shelfd: { name: "たなのかざり", pos: "right:24px; top:30px;  font-size:26px;" },
  window: { name: "まどかざり", pos: "left:14px;  top:12px;  font-size:20px;" },
  poster: { name: "ポスター",   pos: "left:118px; top:26px;  font-size:24px;" },
};

export const FURNITURE = [
  // ベッド
  { id: "bed_basket", slot: "bed", name: "バスケットベッド", icon: "🧺", price: { coins: 150 } },
  { id: "bed_cloud",  slot: "bed", name: "くもベッド",       icon: "☁️", price: { coins: 300 } },
  { id: "bed_royal",  slot: "bed", name: "おうさまベッド",   icon: "🛏️", price: { hearts: 15 } },
  // ラグ(rugColor を部屋に反映)
  { id: "rug_pink",   slot: "rug", name: "さくらいろラグ",   icon: "🌸", price: { coins: 120 }, rug: "rgba(246,175,190,.4)" },
  { id: "rug_mint",   slot: "rug", name: "ミントラグ",       icon: "🍃", price: { coins: 120 }, rug: "rgba(143,191,136,.35)" },
  { id: "rug_star",   slot: "rug", name: "おほしさまラグ",   icon: "⭐", price: { hearts: 10 }, rug: "rgba(242,193,78,.5)" },
  // 観葉植物
  { id: "plant_cactus", slot: "plant", name: "サボテン",     icon: "🌵", price: { coins: 100 } },
  { id: "plant_flower", slot: "plant", name: "はちうえの花", icon: "🌼", price: { coins: 130 } },
  { id: "plant_bonsai", slot: "plant", name: "ぼんさい",     icon: "🌲", price: { coins: 200 } },
  // 時計
  { id: "clock_round",  slot: "clock", name: "まる時計",     icon: "🕐", price: { coins: 90 } },
  { id: "clock_cuckoo", slot: "clock", name: "はと時計",     icon: "🐦", price: { coins: 220 } },
  // 棚のかざり
  { id: "shelf_books",  slot: "shelfd", name: "えほん",      icon: "📚", price: { coins: 110 } },
  { id: "shelf_photo",  slot: "shelfd", name: "ふたりの写真", icon: "🖼️", price: { hearts: 12 } },
  { id: "shelf_trophy", slot: "shelfd", name: "トロフィー",  icon: "🏆", price: { coins: 260 } },
  // 窓かざり
  { id: "win_curtain",  slot: "window", name: "カーテン",    icon: "🎐", price: { coins: 140 } },
  { id: "win_garland",  slot: "window", name: "ガーランド",  icon: "🎏", price: { coins: 160 } },
  // ポスター
  { id: "poster_sun",   slot: "poster", name: "たいようのポスター", icon: "🌞", price: { coins: 100 } },
  { id: "poster_uchu",  slot: "poster", name: "うちゅうのポスター", icon: "🪐", price: { coins: 180 } },
];
