// --- ヘルパー関数 ---

// ランダムな c を選ぶ
function randomOddC() {
    // 0〜49 のランダム値を生成し、下位 1bit を 1 にして確実に奇数にする
    return (BigInt(Math.floor(Math.random() * 50)) | 1n);
}

// ユークリッドの互除法で GCD を返す
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

// BigInt の差の絶対値を返す
function abs_diff(a, b) {
    const d = a - b;
    return d < 0n ? -d : d;
}

// 関数 f(x) = x^2 + c (mod n)
function fx(x, c, mod) {
    return (x * x + c) % mod;
}

// 短い非同期待ち（イベントループを譲る）
function tick() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

// BigInt -> Number（範囲外は Number.MAX_SAFE_INTEGER）
function toSafeNumberFromBigInt(bi) {
    const MAX_BI = BigInt(Number.MAX_SAFE_INTEGER);
    if (bi > MAX_BI) return Number.MAX_SAFE_INTEGER;
    return Number(bi);
}

// y を指定回進めて trialCount を更新し、state のローカル化でループを高速化する処理
function advanceYByStepsHelper(stepCountBI, state, MAX_TRIALS_NUM) {
    const CHUNK_MAX = BigInt(1e9);
    let remaining = stepCountBI;

    // キャッシュ
    let y = state.y;
    const c = state.c;
    const n = state.n;
    let trial = state.trialCount;
    const MAX_TRIALS = MAX_TRIALS_NUM;

    while (remaining > 0n && trial < MAX_TRIALS) {
        const takeBI = remaining > CHUNK_MAX ? CHUNK_MAX : remaining;
        const take = Number(takeBI);
        for (let k = 0; k < take && trial < MAX_TRIALS; k++) {
            // fx をローカルの y に対して呼ぶ（mod, c はローカル）
            y = fx(y, c, n);
            trial++;
        }
        remaining -= BigInt(take);
    }

    // 書き戻し
    state.y = y;
    state.trialCount = trial;
}

// stepLimit 進行中に部分積で GCD を判定し、state のローカル化と不要計算の削除で高速化する処理
function processChunkHelper(x, stepLimit, state, PART_BLOCK) {
    let part = 1n;
    let inPart = 0;
    let gcdCallsAdded = 0;

    // ローカルキャッシュ
    const n = state.n;
    const c = state.c;
    let y = state.y;
    let trial = state.trialCount;
    const MAX_TRIALS = state.MAX_TRIALS_NUM;

    for (let i = 0; i < stepLimit && trial < MAX_TRIALS; i++) {
        y = fx(y, c, n);
        trial++;

        const diff = x > y ? x - y : y - x; // abs_diff をインライン化（少し速い）
        if (diff === 0n) {
            // 書き戻して終了（bad collision）
            state.y = y;
            state.trialCount = trial;
            return { dFound: n, gcdCallsAdded, badCollision: true };
        }

        // diff < n 前提なので % n は不要
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

    // leftover
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

    // 書き戻し
    state.y = y;
    state.trialCount = trial;
    return { dFound: 1n, gcdCallsAdded, badCollision: false };
}

// d === n 時の線形探索で復旧しつつ、state のローカル化と非同期待ちの削減で高速化する処理
async function doFallbackHelper(x_prev, state, MAX_TRIALS_NUM, LOG_INTERVAL_NUM, maybeLogFunc, workerId) {
    let ys = x_prev;

    // キャッシュ
    const c = state.c;
    const n = state.n;
    let trial = state.trialCount;
    const MAX_TRIALS = MAX_TRIALS_NUM;

    let g = 1n;
    while (g === 1n && trial < MAX_TRIALS) {
        ys = fx(ys, c, n);
        trial++;
        g = gcd(x_prev > ys ? x_prev - ys : ys - x_prev, n);

        // 最低限のログを残す
        if (typeof maybeLogFunc === "function") {
            maybeLogFunc(trial, LOG_INTERVAL_NUM, () =>
                `worker ${workerId + 1} フォールバック中 試行 ${trial}, c=${c}, g=${g}`
            ).catch(() => {});
        }
    }

    // 書き戻し
    state.trialCount = trial;
    return g;
}

// --- ログファクトリ ---
function makeMaybeLogger(initialThreshold) {
    let nextLogThreshold = initialThreshold;
    let emitCount = 0;
    return async function maybeLog(trialCount, logInterval, messageFunc) {
        if (!isFinite(logInterval) || logInterval <= 0) return;
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

// --- ワーカーメイン ---
self.onmessage = async function(event) {
    try {
        const n = event.data.n;
        const workerId = event.data.workerId ?? 0;
        const initialX_in = event.data.initialX;

        const MAX_TRIALS_BI = event.data.MAX_TRIALS ?? 100000000n;
        const LOG_INTERVAL_BI = event.data.logInterval ?? 2500000n;

        const MAX_TRIALS_NUM = toSafeNumberFromBigInt(MAX_TRIALS_BI);
        const LOG_INTERVAL_NUM = toSafeNumberFromBigInt(LOG_INTERVAL_BI);

        const maybeLog = makeMaybeLogger(LOG_INTERVAL_NUM);

        if (n <= 3n) {
            postMessage({ stopped: true });
            return;
        }

        let c =  3n; //randomOddC();
        const digitCount = n.toString(10).length;
        let m = digitCount <= 5 ? 32n : digitCount <= 10 ? 64n : digitCount <= 15 ? 128n : 512n;

        // state オブジェクトを用意してヘルパーに渡す
        const state = {
            y: (initialX_in !== undefined && initialX_in !== null) ? initialX_in : 2n,
            c,
            n,
            trialCount: 0,
            MAX_TRIALS_NUM
        };

        let badCollisions = 0;
        let gcdCalls = 0;

        // 初期ステップ
        state.y = fx(state.y, c, n);
        state.trialCount++;

        const PART_BLOCK = 64;

        let x = state.y;
        let d = 1n;
        let r = 1n;

        while (d === 1n && state.trialCount < MAX_TRIALS_NUM) {
            const x_prev = x;

            // ブロック前進（r ステップ）
            x = state.y;
            advanceYByStepsHelper(r, state, MAX_TRIALS_NUM);

            // チャンク処理：m ごとに processChunkHelper を呼ぶ
            let j = 0n;
            while (j < r && d === 1n && state.trialCount < MAX_TRIALS_NUM) {
                const stepLimitBI = (r - j) < m ? (r - j) : m;
                const stepLimit = Number(stepLimitBI);

                const res = processChunkHelper(x, stepLimit, state, PART_BLOCK);
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

            // フォールバック処理
            if (d === n) {
                const g = await doFallbackHelper(x_prev, state, MAX_TRIALS_NUM, LOG_INTERVAL_NUM, maybeLog, workerId);
                d = g;
                if (d === n) {
                    postMessage({ stopped: true, reason: "bad collision (d===n) after linear recovery" });
                    return;
                }
            }

            // outer ログ（非同期で呼び出し、await しない）
            maybeLog(state.trialCount, LOG_INTERVAL_NUM, () =>
                `worker ${workerId + 1} 試行 ${state.trialCount}, gcdCalls=${gcdCalls}, c=${c}`
            ).catch(() => {});

            if (d === 1n) r *= 2n;
        }

        console.log(
            `worker ${workerId + 1} 終了: 試行 ${state.trialCount}, gcdCalls=${gcdCalls}, c=${c}, badCollisions=${badCollisions}`
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
