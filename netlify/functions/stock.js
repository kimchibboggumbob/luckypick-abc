// netlify/functions/stock.js
// CommonJS + Netlify Functions v1 (안전 패치 버전)
const { getStore } = require("@netlify/blobs");

const STORE_NAME = "random-pick-store";
const STOCK_KEY  = "stock-v1";

// 필요에 맞게 초기값 수정
const INITIAL_STOCK = [
  { name: "클렌징워터 미니", remain: 348 },
  { name: "포밍클렌저 미니", remain: 348 },
  { name: "소프트닝 미니", remain: 348 },
  { name: "비타민미스트 미니", remain: 348 },
  { name: "트리트먼트 미니", remain: 348 },
  { name: "바디워시 미니", remain: 348 },
  { name: "바디로션 미니", remain: 348 },
  { name: "프로텍트uv 미니", remain: 348 },
  { name: "모이스처샴푸 미니", remain: 348 },
  { name: "리페어샴푸 미니", remain: 348 },
];

exports.handler = async (event) => {
  try {
    const store  = getStore(STORE_NAME);
    const qs     = event.queryStringParameters || {};
    const action = qs.action || null;

    if (event.httpMethod === "GET") {
      const txt   = await store.get(STOCK_KEY);
      const stock = txt ? JSON.parse(txt) : INITIAL_STOCK;
      return ok({ stock });
    }

    if (event.httpMethod === "POST" && action === "draw") {
      const body   = safeJSON(event.body) || {};
      const count  = clampInt(body.count, 1, 50);

      const txt    = await store.get(STOCK_KEY);
      const stock  = txt ? JSON.parse(txt) : INITIAL_STOCK;

      // 잔여 기반 추첨 풀
      let pool = [];
      stock.forEach((item, idx) => {
        for (let i = 0; i < item.remain; i++) pool.push(idx);
      });
      if (pool.length === 0) return bad({ ok: false, reason: "no_stock" });

      // 비복원 추첨 + 차감
      const results = [];
      for (let i = 0; i < count && pool.length > 0; i++) {
        const pickIndex = Math.floor(Math.random() * pool.length);
        const idx = pool[pickIndex];
        results.push(stock[idx].name);
        stock[idx].remain = Math.max(0, stock[idx].remain - 1);
        pool.splice(pickIndex, 1);
      }

      await store.set(STOCK_KEY, JSON.stringify(stock));
      return ok({ ok: true, results, stock });
    }

    if (event.httpMethod === "POST" && action === "update") {
      const token = event.headers["x-admin-token"];
      if (token !== (process.env.ADMIN_TOKEN || "")) {
        return { statusCode: 403, body: "forbidden" };
      }
      const items = safeJSON(event.body);
      if (!Array.isArray(items)) return { statusCode: 400, body: "bad format" };
      const next = items.map((x) => ({
        name: String(x.name || ""),
        remain: Math.max(0, Number(x.remain || 0)),
      }));
      await store.set(STOCK_KEY, JSON.stringify(next));
      return ok({ ok: true, stock: next });
    }

    return { statusCode: 400, body: "bad request" };
  } catch (e) {
    // 함수 로그에서 원인 확인 가능
    console.error("[stock] internal error:", e);
    return { statusCode: 500, body: "internal error" };
  }
};

// helpers
function ok(obj)  { return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) }; }
function bad(obj) { return { statusCode: 400, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) }; }
function safeJSON(s) { try { return JSON.parse(s || "null"); } catch { return null; } }
function clampInt(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}
