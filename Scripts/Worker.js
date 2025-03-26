console.log("Worker ロード成功");
console.log(`利用可能なスレッド数: ${navigator.hardwareConcurrency}`);

self.onmessage = async function(event) {
    try {
        let { n, fxType } = event.data;
        
        // ✅ `n` の型チェックと `BigInt` 変換
        console.log(`[Worker ${fxType}] 受信時の n の型: ${typeof n}, 値: ${n}`);
        if (typeof n === "string") {
            console.log(`[Worker ${fxType}] n を BigInt に変換`);
            n = BigInt(n);
        }

        console.log(`Worker がメッセージを受信: fxType = ${fxType}`);

        const MAX_TRIALS = {
            fx1: 500000n,
            fx2: 3000000n,
            fx3: 100000000n
        };

        let { maxC } = getDigitBasedParams(n);
        let c = getRandomC(n, maxC);
        console.log(`Worker が c を決定: ${c} (範囲: 1 ～ ${maxC * 2 - 1})`);

        let fxFunction;
        if (fxType === "fx1") {
            fxFunction = (x, c, n) => (x * x + 7n * x + c) % n;
        } else if (fxType === "fx2") {
            fxFunction = (x, c, n) => (x * x + c * x) % n;
        } else if (fxType === "fx3") {
            fxFunction = (x, c, n) => (x * x * x + 7n * x * x + c * x + c) % n;
        } else {
            throw new Error("Unknown fxType");
        }

        let x = 2n, y = 2n, d = 1n;
        let trialCount = 0n;
        let q = 1n;
        let m = 128n;
        let k = 10n;
        let resetCount = 0;

        x = fxFunction(x, c, n);
        y = fxFunction(fxFunction(y, c, n), c, n);

        while (d === 1n && trialCount < MAX_TRIALS[fxType]) {
            let ys = y;
            for (let i = 0n; i < m && trialCount < MAX_TRIALS[fxType]; i++) {
                y = fxFunction(fxFunction(y, c, n), c, n);
                q *= abs(x - y);
                q = (q + 1n) % n;
                trialCount++;

                if (q === 0n) {
                    console.error(`[Worker ${fxType}] q が 0 になった！（リセット回数: ${resetCount}）`);
                    q = 1n;
                    resetCount++;
                }

                // ✅ `BigInt` の剰余計算が正しく行われているか確認
                if (trialCount === 1n || trialCount % 5000000n === 0n) {
                    console.log(`[Worker ${fxType}] BigInt mod テスト: ${(3n % 1n).toString()}`);
                }

                // 【実験用】
                if (fxType === "fx3" && trialCount === 25000000n) {
                    console.log(`[Worker ${fxType}] 実験的に仮の因数を送信！`);
                    postMessage({ factor: "9999991", trials: trialCount.toString(), test: true });
                }

                if (fxType === "fx1" && trialCount === 1n) {
                    console.log(`[Worker ${fxType}] 実験的に仮の因数を送信！`);
                    postMessage({ factor: "9999991", trials: trialCount.toString(), test: true });
                }

                if (trialCount % 5000000n === 0n) {
                    console.log(`[Worker ${fxType}] 試行 ${trialCount}, x=${x}, y=${y}, q=${q}, d=${d}`);
                    await new Promise(resolve => setTimeout(resolve, 0));
                }

                if (i % (k + (m / 16n)) === 0n) {
                    d = gcd(q, n);
                    if (d > 1n) break;
                }
            }
            x = ys;
            if (d === 1n) {  
                m = (m * 3n) >> 1n;
            }
        }

        if (d > 1n && d !== n) {
            console.log(`[Worker ${fxType}] 因数 ${d} を送信！（試行回数: ${trialCount}）`);
            
            // ✅ `postMessage()` の直前に `setTimeout()` を追加し、Worker の競合を防ぐ
            setTimeout(() => {
                postMessage({ factor: d.toString(), trials: trialCount.toString() });
            }, 0);
            
            return;
        }

        console.log(`Worker ${fxType} が試行上限 ${MAX_TRIALS[fxType]} に達したため停止。`);
        postMessage({ stopped: true });

    } catch (error) {
        console.error(`Worker でエラー: ${error.stack}`);
        postMessage({ error: error.stack });
    }
};

function getDigitBasedParams(n) {
    try {
        let digitCount = n.toString().length;
        return { maxC: digitCount <= 20 ? 30 : 50 };
    } catch (error) {
        console.error("getDigitBasedParams() でエラー:", error.message);
        return { maxC: 50 };
    }
}

function getRandomC(n, maxC) {
    try {
        const buffer = new Uint32Array(1);
        crypto.getRandomValues(buffer);
        return BigInt((buffer[0] % maxC) * 2 + 1);
    } catch (error) {
        console.error("getRandomC() でエラー:", error.message);
        return 1n;
    }
}

function gcd(a, b) {
    if (a === 0n) return b;
    if (b === 0n) return a;

    let shift = 0n;
    while (((a | b) & 1n) === 0n) {
        a >>= 1n;
        b >>= 1n;
        shift++;
    }

    while ((a & 1n) === 0n) a >>= 1n;
    while (b !== 0n) {
        while ((b & 1n) === 0n) b >>= 1n;
        if (a > b) [a, b] = [b, a];
        b -= a;
        if (b === 0n) break;
    }

    return a << shift;
}

function abs(n) {
    return n < 0n ? -n : n;
}
