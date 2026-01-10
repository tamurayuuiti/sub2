// pollards-rho.worker.js - Pollard's Rho 法ワーカー

// ユークリッドの互除法
function gcd(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

// 引数検証
function requireNumberFinitePositiveInteger(name, v) {
  if (typeof v !== "number") return postErrorAndReturn(`${name} must be Number.`);
  if (!Number.isFinite(v)) return postErrorAndReturn(`${name} must be finite Number.`);
  if (!Number.isInteger(v)) return postErrorAndReturn(`${name} must be integer.`);
  if (v <= 0) return postErrorAndReturn(`${name} must be > 0.`);
  return true;
}

// BigInt検証
function requireBigInt(name, v) {
  if (typeof v !== "bigint") return postErrorAndReturn(`${name} must be BigInt.`);
  return true;
}

// エラーメッセージ送信と false 戻り
function postErrorAndReturn(msg) {
  try { postMessage({ error: msg }); } catch (e) {}
  return false;
}

// 非同期ティック
function tick() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

// チャンク処理
function processChunkHelper(x, stepLimit, state, PART_BLOCK, MAX_TRIALS) {
  let part = 1n;
  let inPart = 0;
  let gcdCallsAdded = 0;

  const n = state.n;
  const c = state.c;
  let y = state.y;
  let trial = state.trialCount;

  for (let i = 0; i < stepLimit && trial < MAX_TRIALS; i++) {
    y = (y * y + c) % n;
    trial++;

    const diff = x > y ? x - y : y - x;
    if (diff === 0n) {
      state.y = y;
      state.trialCount = trial;
      return { dFound: n, gcdCallsAdded, badCollision: true };
    }

    part = (part * diff) % n;
    inPart++;

    if (inPart >= PART_BLOCK) {
      gcdCallsAdded++;
      
      const g = gcd(part, n);
      if (g > 1n && g < n) {
        state.y = y;
        state.trialCount = trial;
        return { dFound: g, gcdCallsAdded, badCollision: false };
      }
      if (g === n) {
        state.y = y;
        state.trialCount = trial;
        return { dFound: n, gcdCallsAdded, badCollision: true };
      }
      part = 1n;
      inPart = 0;
    }
  }

  if (inPart > 0) {
    gcdCallsAdded++;
    const g = gcd(part, n);
    if (g > 1n && g < n) {
      state.y = y;
      state.trialCount = trial;
      return { dFound: g, gcdCallsAdded, badCollision: false };
    }
    if (g === n) {
      state.y = y;
      state.trialCount = trial;
      return { dFound: n, gcdCallsAdded, badCollision: true };
    }
  }

  state.y = y;
  state.trialCount = trial;
  return { dFound: 1n, gcdCallsAdded, badCollision: false };
}

// フォールバック処理
async function doFallbackHelper(x_prev, state, MAX_TRIALS, LOG_INTERVAL, maybeLogFunc, workerId) {
  let ys = x_prev;
  const c = state.c;
  const n = state.n;
  let trial = state.trialCount;

  let g = 1n;
  while (g === 1n && trial < MAX_TRIALS) {
    ys = (ys * ys + c) % n;
    trial++;

    g = gcd(x_prev > ys ? x_prev - ys : ys - x_prev, n);

    if (typeof maybeLogFunc === "function") {
      await maybeLogFunc(trial, LOG_INTERVAL, () =>
        `worker ${workerId + 1} 再検査中... ${trial} ステップ (c=${c})`
      );
    }
  }

  state.trialCount = trial;
  return g;
}

// ログ出力用ファクトリ
function makeMaybeLogger(initialThreshold) {
  let nextLogThreshold = initialThreshold;
  let emitCount = 0;
  return async function maybeLog(trialCount, logInterval, messageFunc) {
    if (!Number.isFinite(logInterval) || logInterval <= 0) return;
    
    if (trialCount >= nextLogThreshold) {
      const msg = String(messageFunc());
      try { postMessage({ log: msg }); } catch (e) {}
      
      const over = Math.floor((trialCount - nextLogThreshold) / logInterval) + 1;
      nextLogThreshold += over * logInterval;
      
      emitCount++;
      if (emitCount % 5 === 0) await tick();
    }
  };
}

// メイン処理
self.onmessage = async function(event) {
  try {
    const n = event.data.n;
    const workerId = event.data.workerId;
    const initialX_in = event.data.initialX;

    if (!requireNumberFinitePositiveInteger("MAX_TRIALS", event.data.MAX_TRIALS)) return;
    if (!requireNumberFinitePositiveInteger("logInterval", event.data.logInterval)) return;
    if (!requireBigInt("c", event.data.c)) return;
    if (!requireBigInt("m", event.data.m)) return;
    if (!requireNumberFinitePositiveInteger("PART_BLOCK", event.data.PART_BLOCK)) return;

    const MAX_TRIALS = event.data.MAX_TRIALS;
    const LOG_INTERVAL = event.data.logInterval;
    const c = event.data.c;
    const m = event.data.m;
    const PART_BLOCK = event.data.PART_BLOCK;

    const maybeLog = makeMaybeLogger(LOG_INTERVAL);

    if (n <= 3n) {
      postMessage({ stopped: true });
      return;
    }

    const state = {
      y: (initialX_in !== undefined && initialX_in !== null) ? initialX_in : 2n,
      c,
      n,
      trialCount: 0
    };

    let badCollisions = 0;
    let gcdCalls = 0;

    state.y = (state.y * state.y + c) % n;
    state.trialCount++;

    let x = state.y;
    let d = 1n;
    let r = 1n;

    while (d === 1n && state.trialCount < MAX_TRIALS) {
      const x_prev = x;
      x = state.y;
      
      let j = 0n;
      while (j < r && d === 1n && state.trialCount < MAX_TRIALS) {
        const stepLimitBI = (r - j) < m ? (r - j) : m;
        const stepLimit = Number(stepLimitBI);
        
        const res = processChunkHelper(x, stepLimit, state, PART_BLOCK, MAX_TRIALS);
        
        gcdCalls += res.gcdCallsAdded;
        if (res.dFound !== 1n) {
          if (res.badCollision) {
            badCollisions++;
            d = state.n;
            break;
          } else {
            d = res.dFound;
            break;
          }
        }
        j += BigInt(stepLimit);

        await maybeLog(state.trialCount, LOG_INTERVAL, () =>
          `worker ${workerId + 1} 探索中... ${state.trialCount} ステップ経過`
        );
      }

      if (d === n) {
        const g = await doFallbackHelper(x_prev, state, MAX_TRIALS, LOG_INTERVAL, maybeLog, workerId);
        d = g;
        if (d === n) {
          postMessage({ stopped: true, reason: "bad collision (d===n) after linear recovery" });
          return;
        }
      }

      if (d === 1n) r *= 2n;
    }

    console.log(
      `worker ${workerId + 1} 完了: ${state.trialCount} ステップ (c=${c})`
    );

    if (d > 1n && d !== n) {
      postMessage({ factor: d.toString(), trials: String(state.trialCount) });
    } else {
      postMessage({ stopped: true, trials: String(state.trialCount) });
    }

  } catch (err) {
    postMessage({ error: String(err && err.stack ? err.stack : err) });
  }
};
