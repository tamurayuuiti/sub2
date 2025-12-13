// ユークリッド（剰余）GCD
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

// 短い非同期待ち
function tick() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

// エラーメッセージをメインスレッドにポストし、false を返す
function postErrorAndReturn(msg) {
  try { postMessage({ error: msg }); } catch (e) {}
  return false;
}

// 値が有限な正の整数 (Number) であることを検証
function requireNumberFinitePositiveInteger(name, v) {
  if (typeof v !== "number") return postErrorAndReturn(`${name} must be Number.`);
  if (!Number.isFinite(v)) return postErrorAndReturn(`${name} must be finite Number.`);
  if (!Number.isInteger(v)) return postErrorAndReturn(`${name} must be integer.`);
  if (v <= 0) return postErrorAndReturn(`${name} must be > 0.`);
  return true;
}

// 値が BigInt 型であることを検証
function requireBigInt(name, v) {
  if (typeof v !== "bigint") return postErrorAndReturn(`${name} must be BigInt.`);
  return true;
}

// y を指定回進めて trialCount を更新
function advanceYByStepsHelper(stepCountBI, state, MAX_TRIALS) {
  const CHUNK_MAX = BigInt(1e6);
  let remaining = stepCountBI;

  let y = state.y;
  const c = state.c;
  const n = state.n;
  let trial = state.trialCount;

  while (remaining > 0n && trial < MAX_TRIALS) {
    const takeBI = remaining > CHUNK_MAX ? CHUNK_MAX : remaining;
    const take = Number(takeBI);
    for (let k = 0; k < take && trial < MAX_TRIALS; k++) {
      y = (y * y + c) % n;
      trial++;
    }
    remaining -= BigInt(take);
  }

  state.y = y;
  state.trialCount = trial;
}

// stepLimit 進行中に部分積で GCD を判定
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

// フォールバック
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
      maybeLogFunc(trial, LOG_INTERVAL, () =>
        `worker ${workerId + 1} フォールバック中 試行 ${trial}, c=${c}, g=${g}`
      ).catch(() => {});
    }
  }

  state.trialCount = trial;
  return g;
}

// ログファクトリ
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
      if (emitCount % 10 === 0) await tick();
    }
  };
}

// ワーカーメイン
self.onmessage = async function(event) {
  try {
    const n = event.data.n;
    const workerId = event.data.workerId;
    const initialX_in = event.data.initialX;

    // 必須パラメータの型/値検証
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

    // state 初期化
    const state = {
      y: (initialX_in !== undefined && initialX_in !== null) ? initialX_in : 2n,
      c,
      n,
      trialCount: 0
    };

    let badCollisions = 0;
    let gcdCalls = 0;

    // 初期ステップ
    state.y = (state.y * state.y + c) % n;
    state.trialCount++;

    let x = state.y;
    let d = 1n;
    let r = 1n;

    while (d === 1n && state.trialCount < MAX_TRIALS) {
      const x_prev = x;

      // ブロック前進（r ステップ）
      x = state.y;
      advanceYByStepsHelper(r, state, MAX_TRIALS);

      // チャンク処理（m ごと）
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
      }

      // フォールバック
      if (d === n) {
        const g = await doFallbackHelper(x_prev, state, MAX_TRIALS, LOG_INTERVAL, maybeLog, workerId);
        d = g;
        if (d === n) {
          postMessage({ stopped: true, reason: "bad collision (d===n) after linear recovery" });
          return;
        }
      }

      // ログ出力
      maybeLog(state.trialCount, LOG_INTERVAL, () =>
        `worker ${workerId + 1} 試行 ${state.trialCount}, gcdCalls=${gcdCalls}, c=${c}, PART_BLOCK=${PART_BLOCK}`
      ).catch(() => {});

      if (d === 1n) r *= 2n;
    }

    console.log(
      `worker ${workerId + 1} 終了: 試行 ${state.trialCount}, gcdCalls=${gcdCalls}, c=${c}, badCollisions=${badCollisions}, PART_BLOCK=${PART_BLOCK}`
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
