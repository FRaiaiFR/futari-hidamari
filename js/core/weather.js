// =====================================================================
// 天気連動(窓の外だけ変わる)
// Open-Meteo(APIキー不要・無料)を使用。位置情報が取れない/通信失敗時は「晴れ」。
// 30分キャッシュして通信を節約。
// =====================================================================
const KEY = "hdm_weather";
const TTL = 30 * 60 * 1000;

/** 'sunny' | 'rain' | 'cloud' | 'snow' を返す(即時はキャッシュ、裏で更新) */
export function cachedWeather() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || "null");
    if (c && Date.now() - c.at < TTL) return c.kind;
  } catch { /* noop */ }
  return "sunny";
}

export async function fetchWeather() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || "null");
    if (c && Date.now() - c.at < TTL) return c.kind;
  } catch { /* noop */ }
  try {
    const pos = await new Promise((res, rej) => {
      if (!navigator.geolocation) return rej();
      navigator.geolocation.getCurrentPosition(res, rej, { timeout: 4000, maximumAge: 600000 });
    });
    const { latitude, longitude } = pos.coords;
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(2)}&longitude=${longitude.toFixed(2)}&current=weather_code`,
      { signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined });
    const j = await r.json();
    const kind = codeToKind(j?.current?.weather_code);
    localStorage.setItem(KEY, JSON.stringify({ kind, at: Date.now() }));
    return kind;
  } catch {
    return "sunny"; // 位置情報拒否・通信失敗 → 晴れ
  }
}

function codeToKind(code) {
  if (code == null) return "sunny";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if (code >= 51 && code <= 99) return "rain";
  if ([1, 2, 3, 45, 48].includes(code)) return "cloud";
  return "sunny";
}
