self.onmessage = async function(event) {
    try {
        let { n, fxType, workerId, xStart, xEnd } = event.data;
        if (typeof workerId === "undefined") {
            throw new Error("workerId が undefined です");
        }

        n = BigInt(n);
        xStart = BigInt(xStart);
        xEnd = BigInt(xEnd);
        
        let { maxC } = getDigitBasedParams(n);
        let c = getRandomC(n, maxC);

        const MAX_TRIALS = {
            fx1: 500000n,
            fx2: 100000000n
        };

        let fxFunction;
        let fxEquation;

        if (fxType === "fx1") {
            fxEquation = "(3x² + 7x + c) mod n";
            fxFunction = (x, c, n) => (3n * x * x + 7n * x + c) % n;
        } else if (fxType === "fx2") {
            fxEquation = "(x³ + 5x + c) mod n";
            fxFunction = (x, c, n) => (x * x * x + 5n * x + c) % n;
        } else {
            throw new Error("Unknown fxType");
        }

        console.log(`Worker ${workerId + 1} の実行開始: fx = ${fxEquation}, 範囲 [${xStart}, ${xEnd}]`);

        let x = xStart;
        let y = xStart;
        let d = 1n;
        let trialCount = 0n;
        let q = 1n;
        let m = 128n;
        let k = 10n;
        let resetCount = 0;

        x = fxFunction(x, c, n);
        y = fxFunction(fxFunction(y, c, n), c, n);

        while (d === 1n && trialCount < MAX_TRIALS[fxType] && x < xEnd) {
            let ys = y;
            for (let i = 0n; i < m && trialCount < MAX_TRIALS[fxType] && x < xEnd; i++) {
                y = fxFunction(fxFunction(y, c, n), c, n);
                q = abs(x - y) * q % n;
                trialCount++;
                x++;

                if (q === 0n) {
                    console.error(`worker ${workerId + 1} q が 0 になりました。（リセット回数: ${resetCount}）`);
                    q = 1n;
                    resetCount++;
                }

                if (trialCount % 1000000n === 0n) {
                    console.log(`worker ${workerId + 1} 試行 ${trialCount}, fx = ${fxType}, x=${x}, y=${y}, q=${q}, gcd=${d}`);
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
            console.log(`worker ${workerId + 1} が因数 ${d} を送信（試行回数: ${trialCount}）`);
            postMessage({ factor: d.toString(), trials: trialCount.toString() });
            return;
        }

        console.log(`worker ${workerId + 1} が試行上限 ${MAX_TRIALS[fxType]} に達したため停止`);
        postMessage({ stopped: true });

    } catch (error) {
        console.error(`worker でエラー: ${error.stack}`);
        postMessage({ error: error.stack });
    }
};

function getDigitBasedParams(n) {
    try {
        let digitCount = n.toString().length;
        return { maxC: digitCount <= 20 ? 30n : 50n };
    } catch (error) {
        console.error("getDigitBasedParams() でエラー:", error.message);
        return { maxC: 50n };
    }
}

function getRandomC(n, maxC) {
    try {
        const buffer = new Uint32Array(1);
        crypto.getRandomValues(buffer);
        return BigInt((buffer[0] % Number(maxC)) * 2 + 1);
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
