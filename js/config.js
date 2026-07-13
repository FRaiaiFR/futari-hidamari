// =====================================================================
// ふたりのひだまり - 設定ファイル
// ★ 自分で書き換えるのは、このファイルと database.rules.json だけです。
//    手順は SETUP.md を見てください。
// =====================================================================

// ① Firebaseコンソール > プロジェクトの設定 > マイアプリ からコピーして
//    まるごと貼り替えてください。
export const firebaseConfig = {
  apiKey: "AIzaSyBZNKIzDhk9YtSxxar5nNdS_ZSbPsZ0p8U",
  authDomain: "futari-hidamari.firebaseapp.com",
  databaseURL: "https://futari-hidamari-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "futari-hidamari",
  storageBucket: "futari-hidamari.firebasestorage.app",
  messagingSenderId: "859932769883",
  appId: "1:859932769883:web:f3f02e6037260a3facc97e",
};

// ② ふたりの情報。email は Firebase Authentication で作成した
//    2アカウントのメールアドレスと完全に一致させてください。
//    name / emoji / color は自由に変えてOKです。
export const PARTNERS = [
  { key: "p1", name: "あいら",     email: "aira@game.com", color: "#6D9BC3", emoji: "🫐" },
  { key: "p2", name: "ゆかり", email: "yukari@game.com", color: "#EF8E7D", emoji: "🍑" },
];

// ③ アプリ全体の設定
export const APP = {
  defaultPetName: "もこ",   // ペットの初期名(設定画面でいつでも変更可)
  version: "1.0.0",
};
