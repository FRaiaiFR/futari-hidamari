// =====================================================================
// ふたりのひだまり - 設定ファイル
// ★★★ このファイルは「あなたの設定ずみの状態」で入っています ★★★
//     今後アプリを更新するとき、このファイルは上書きしても壊れません。
// =====================================================================

// ① Firebaseの設定値(設定ずみ)
export const firebaseConfig = {
  apiKey: "AIzaSyBZNKIzDhk9YtSxxar5nNdS_ZSbPsZ0p8U",
  authDomain: "futari-hidamari.firebaseapp.com",
  // ★databaseURLだけ確認してください:
  //   Firebase → Realtime Database の画面上部に出ているURLと同じにすること。
  //   「asia-southeast1」が入らない形式の場合は下の行を書き換えてください。
  databaseURL: "https://futari-hidamari-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "futari-hidamari",
  storageBucket: "futari-hidamari.firebasestorage.app",
  messagingSenderId: "859932769883",
  appId: "1:859932769883:web:f3f02e6037260a3facc97e",
};

// ② ふたりの情報(設定ずみ)
export const PARTNERS = [
  { key: "p1", name: "あいら", email: "aira@game.com",   color: "#6D9BC3", emoji: "🍇" },
  { key: "p2", name: "ゆかり", email: "yukari@game.com", color: "#EF8E7D", emoji: "🍑" },
];

// ③ アプリ全体の設定
export const APP = {
  defaultPetName: "もこ",   // ペットの初期名(設定画面でいつでも変更可)
  version: "1.2.0",
  // AIセリフ(まだ準備しない場合は "" のままでOK。セットアップは EXTENDING.md 9章)
  ai: { workerUrl: "" },
};
