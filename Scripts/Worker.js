self.onmessage = async function(event) {
    try {
        const { n, fxType, attempt } = event.data;
        console.log(`✅ Worker がメッセージを受信: fxType = ${fxType}, attempt = ${attempt}`);

        let { maxC } = getDigitBasedParams(n, attempt);
        let c = getRandomC(n, attempt, maxC);
        console.log(`🎲 Worker が c を決定: ${c} (範囲: 1 ～ ${maxC * 2 - 1})`);

        let fxFunction;
        if (fxType === "fx1") {
            fxFunction = (x, c, n) => (x * x * x + c) % n;
        } else if (fxType === "fx2") {
            fxFunction = (x, c, n) => (x * x + c * x) % n;
        } else if (fxType === "fx3") {
            fxFunction = (x, c, n) => (x * x * x + 3n * x + c) % n;
        } else if (fxType === "fx4") {
            fxFunction = (x, c, n) => (x * x + 7n * x + c) % n;
        } else {
            postMessage({ error: "Unknown fxType" });
            return;
        }

        let x = 2n;
        let y = fxFunction(x, c, n);
        let d = 1n;
        let trialCount = 0n;
        let q = 1n;
        let m = 128n;

        while (d === 1n && trialCount < 100000000n) {
            let ys = y;
            for (let i = 0n; i < m && trialCount < 100000000n; i++) {
                y = fxFunction(fxFunction(y, c, n), c, n);
                q *= abs(x - y);
                if (q >= n) q %= n;
                trialCount++;

                if (q === 0n) {
                    console.error(`❌ Worker でエラー: q が 0 になりました。`);
                    q = 1n;
                }

                if (trialCount % 500000n === 0n) {  // ✅ 10000回ごとにログを出力し、UIを解放
                    console.log(`🔄 Worker ${fxType}: ${trialCount} 回試行中...`);
                    await new Promise(resolve => setTimeout(resolve, 0)); // ✅ UIのフリーズ防止
                }

                d = gcd(q, n);
                if (d > 1n && d !== n) {
                    console.log(`🎯 Worker ${fxType} が因数 ${d} を発見！（試行回数: ${trialCount}）`);
                    postMessage({ factor: d, trials: trialCount });
                    return;
                }
            }
            x = ys;
        }

        console.log(`❌ Worker ${fxType} は 100万回試行しても因数を見つけられませんでした。`);
        postMessage({ factor: null });
    } catch (error) {
        console.error(`❌ Worker でエラー: ${error.message}`);
        postMessage({ error: error.message });
    }
};

// ✅ Worker 内部で `getDigitBasedParams` を定義
function getDigitBasedParams(n, attempt) {
    let digitCount = Math.floor(Math.log10(Number(n))) + 1;
    return { maxC: digitCount <= 20 ? 30 : 50 };
}

// ✅ Worker 内部で `getRandomC` を定義
function getRandomC(n, attempt, maxC) {
    return BigInt((Math.floor(Math.random() * maxC) * 2) + 1);
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
