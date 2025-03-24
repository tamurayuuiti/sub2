self.onmessage = function(event) {
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

        while (d === 1n && trialCount < 1000000n) {
            y = fxFunction(fxFunction(y, c, n), c, n);
            q *= abs(x - y);
            if (q >= n) q %= n;
            trialCount++;

            if (q === 0n) {
                console.error(`❌ Worker でエラー: q が 0 になりました。`);
                q = 1n;
            }

            d = gcd(q, n);
            if (d > 1n) {
                console.log(`🎯 Worker が因数 ${d} を発見！（試行回数: ${trialCount}）`);
                postMessage({ factor: d, trials: trialCount });
                return;
            }
        }

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
