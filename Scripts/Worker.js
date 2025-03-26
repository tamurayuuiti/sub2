console.log("Worker ロード成功");
console.log(`利用可能なスレッド数: ${navigator.hardwareConcurrency}`);

self.onmessage = async function(event) {
    try {
        const { n, workerId } = event.data;
        console.log(`Worker ${workerId} がメッセージを受信`);

        let factor = await pollardsRho(n, workerId);

        if (factor) {
            console.log(`[Worker ${workerId}] 因数 ${factor} を発見！`);
            postMessage({ factor: factor.toString(), trials: "1" });
        } else {
            console.log(`[Worker ${workerId}] 因数を発見できず。`);
            postMessage({ stopped: true });
        }

    } catch (error) {
        console.error(`Worker ${workerId} でエラー: ${error.stack}`);
        postMessage({ error: error.stack });
    }
};

async function pollardsRho(n, workerId) {
    let attempt = 0;

    while (true) {
        let { k, fxFunction, fxFunctionString, digitCount, MAX_TRIALS } = getDigitBasedParams(n, attempt);
        let trialCount = 0n;
        let x = 2n, y = 2n, d = 1n;
        let m = 128n, q = 1n;
        let c = getRandomC(n, attempt);

        console.log(`[Worker ${workerId}] 試行 ${attempt + 1}: 使用中の f(x) = ${fxFunctionString}, MAX_TRIALS = ${MAX_TRIALS}`);

        if (digitCount >= 21 && attempt >= 3) {
            console.log(`[Worker ${workerId}] Pollard's Rho では因数を発見できませんでした。`);
            return null;
        }

        x = fxFunction(x, c, n);
        y = fxFunction(fxFunction(y, c, n), c, n);

        while (d === 1n && trialCount < BigInt(MAX_TRIALS)) {
            let ys = y;
            for (let i = 0n; i < m && trialCount < BigInt(MAX_TRIALS); i++) {
                y = fxFunction(fxFunction(y, c, n), c, n);
                q *= abs(x - y);
                if (q >= n) q %= n;
                trialCount++;

                if (q === 0n) {
                    console.log(`[Worker ${workerId}] q が 0 になりました。リセットします。`);
                    q = 1n;
                }

                if (i % (k + (m / 16n)) === 0n) {
                    d = gcd(q, n);
                    if (d > 1n) break;
                }

                if (i % 100000n === 0n) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }

            x = ys;
            if (d === 1n) {
                m = (m * 3n) >> 1n;
            }
        }

        if (d > 1n && d !== n) {
            console.log(`[Worker ${workerId}] 因数を発見: ${d} (試行回数: ${trialCount})`);
            return d;
        }

        console.log(`[Worker ${workerId}] 試行回数 ${MAX_TRIALS} を超過。c を変更して再試行 (${attempt + 1}回目)`);
        attempt++;
    }
}

function getDigitBasedParams(n, attempt = 0) {
    let digitCount = n.toString().length;

    let k = digitCount <= 20 ? 10n : digitCount <= 30 ? 15n : 25n;
    let maxC = digitCount <= 20 ? 30 : 50;
    let MAX_TRIALS;
    let fxFunction;
    let fxFunctionString;

    if (digitCount <= 20) {
        fxFunction = (x, c, n) => ((x + c) * (x + c) + c) % n;
        fxFunctionString = "((x + c)² + c) % n";
        MAX_TRIALS = 1000000;
    } else {
        if (attempt === 0) {
            fxFunction = (x, c, n) => ((x * x + 7n * x + c) % n);
            fxFunctionString = "(x² + 7x + c) % n";
            MAX_TRIALS = 500000;
        } else if (attempt === 1) {
            fxFunction = (x, c, n) => ((x * x + c * x) % n);
            fxFunctionString = "(x² + cx) % n";
            MAX_TRIALS = 3000000;
        } else if (attempt === 2) {
            fxFunction = (x, c, n) => ((x * x * x + c) % n);
            fxFunctionString = "(x³ + c) % n";
            MAX_TRIALS = 500000000;
        } else {
            fxFunction = null;
            fxFunctionString = "別の因数分解関数に移行";
            MAX_TRIALS = 0;
        }
    }

    return { digitCount, k, maxC, fxFunction, fxFunctionString, MAX_TRIALS };
}

function getRandomC(n, attempt = 0) {
    let { maxC } = getDigitBasedParams(n, attempt);
    let c = BigInt((Math.floor(Math.random() * maxC) * 2) + 1);
    return c;
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
