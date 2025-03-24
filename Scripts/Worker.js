self.onmessage = function(event) {
    const { x, c, n, fxType } = event.data;

    let fxFunction;
    if (fxType === "fx1") {
        fxFunction = (x, c, n) => (x * x * x + c) % n; // (x³ + c) % n
    } else if (fxType === "fx2") {
        fxFunction = (x, c, n) => (x * x + c * x) % n; // (x² + c x) % n
    } else if (fxType === "fx3") {
        fxFunction = (x, c, n) => (x * x * x + 3n * x + c) % n; // (x³ + 3x + c) % n
    } else if (fxType === "fx4") {
        fxFunction = (x, c, n) => (x * x + 7n * x + c) % n; // (x² + 7x + c) % n
    } else {
        postMessage({ error: "Unknown fxType" });
        return;
    }

    let y = fxFunction(x, c, n);
    let d = 1n;
    let trialCount = 0n;
    let m = 128n;
    let q = 1n;

    while (d === 1n && trialCount < 1000000n) {
        let ys = y;
        for (let i = 0n; i < m && trialCount < 1000000n; i++) {
            y = fxFunction(fxFunction(y, c, n), c, n);
            q *= abs(x - y);
            if (q >= n) q %= n;
            trialCount++;

            if (q === 0n) {
                console.log(`エラー: q が 0 になりました。`);
                q = 1n;
            }

            if (i % 10n === 0n) {
                d = gcd(q, n);
                if (d > 1n) {
                    postMessage({ factor: d, trials: trialCount });
                    return;
                }
            }
        }
        x = ys;
    }

    postMessage({ factor: null });
};

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
