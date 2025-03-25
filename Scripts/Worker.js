console.log("✅ Worker ロード成功");

self.onmessage = async function(event) {
    try {
        const { n, fxType, attempt } = event.data;
        console.log(`✅ Worker がメッセージを受信: fxType = ${fxType}, attempt = ${attempt}`);

        const MAX_TRIALS = {
            fx1: 1000000n,  
            fx2: 5000000n,  
            fx3: 10000000n  
        };

        let { maxC } = getDigitBasedParams(n, attempt);
        let c = getRandomC(n, attempt, maxC);
        console.log(`🎲 Worker が c を決定: ${c} (範囲: 1 ～ ${maxC * 2 - 1})`);

        let fxFunction;
        if (fxType === "fx1") {
            fxFunction = (x, c, n) => (x * x + 7n * x + c) % n;
        } else if (fxType === "fx2") {
            fxFunction = (x, c, n) => (x * x + c * x) % n;
        } else if (fxType === "fx3") {
            fxFunction = (x, c, n) => (x * x * x + c) % n;
        } else {
            throw new Error("❌ Unknown fxType");
        }

        let x = 2n, y = 2n, d = 1n;
        let trialCount = 0n;
        let q = 1n;
        let m = 128n;
        let k = 10n; 

        x = fxFunction(x, c, n);
        y = fxFunction(fxFunction(y, c, n), c, n);

        while (d === 1n && trialCount < MAX_TRIALS[fxType]) {
            let ys = y;
            for (let i = 0n; i < m && trialCount < MAX_TRIALS[fxType]; i++) {
                y = fxFunction(fxFunction(y, c, n), c, n);
                q *= abs(x - y);
                if (q >= n) q %= n;
                trialCount++;

                if (q === 0n) {  // ✅ (4-2) `q` が 0 の場合リセット
                    console.error(`❌ [Worker ${fxType}] q が 0 になったためリセット`);
                    q = 1n;
                }

                if (trialCount % 100000n === 0n) {
                    console.log(`🔄 Worker ${fxType}: ${trialCount} 回試行中...`);
                    await new Promise(resolve => setTimeout(resolve, 0));
                }

                let logCounter = 0n;
                if (i % (k + (m / 16n)) === 0n) {
                    d = gcd(q, n);
    
                    if (logCounter % 1000000n === 0n) { // ✅ ログの出力頻度を調整
                        console.log(`🔍 [Worker ${fxType}] GCD 計算: gcd(${q}, ${n}) = ${d}`);
                    }
                    logCounter++;
                    
                    if (d > 1n) break;
                }
            }
            x = ys;
        }

        if (d > 1n && d !== n) {
            console.log(`📤 [Worker ${fxType}] 因数 ${d} を送信！（試行回数: ${trialCount}）`);
            postMessage({ factor: d.toString(), trials: trialCount.toString() });
            return;
        }

        console.log(`⏹️ Worker ${fxType} が試行上限 ${MAX_TRIALS[fxType]} に達したため停止。`);
        postMessage({ stopped: true });

    } catch (error) {
        console.error(`❌ Worker でエラー: ${error.stack}`);
        postMessage({ error: error.stack });
    }
};

// ✅ Worker 内部で `getDigitBasedParams` を定義
function getDigitBasedParams(n, attempt) {
    try {
        let digitCount = Math.floor(Math.log10(Number(n))) + 1;
        return { maxC: digitCount <= 20 ? 30 : 50 };
    } catch (error) {
        console.error("❌ getDigitBasedParams() でエラー:", error.message);
        return { maxC: 50 };
    }
}

// ✅ Worker 内部で `getRandomC` を定義
function getRandomC(n, attempt, maxC) {
    try {
        return BigInt((Math.floor(Math.random() * maxC) * 2) + 1);
    } catch (error) {
        console.error("❌ getRandomC() でエラー:", error.message);
        return 1n;
    }
}

// ✅ gcd の計算を完全維持
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

// ✅ abs の計算も完全維持
function abs(n) {
    return n < 0n ? -n : n;
}
