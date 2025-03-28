self.onmessage = async function(event) {
    try {
        let { n, fxType, workerId, xRange, c } = event.data;
        let { maxC } = getDigitBasedParams(n);
        
        if (!c) {
            throw new Error("c is required and should be provided by the main thread.");
        }
        
        let fxFunction;
        let fxEquation;

        const MAX_TRIALS = {
            fx1: 500000n,
            fx2: 100000000n
        };

        if (fxType === "fx1") {
            fxEquation = "(3x² + 7x + c) mod n";
            fxFunction = (x, c, n) => (3n * x * x + 7n * x + c) % n;
        } else if (fxType === "fx2") {
            fxEquation = "(x³ + 5x + c) mod n";
            fxFunction = (x, c, n) => (x * x * x + 5n * x + c) % n;
        } else {
            throw new Error("Unknown fxType");
        }

        let x = 2n, y = 2n, d = 1n;
        let trialCount = 0n;
        let q = 1n;
        let m = 128n;
        let k = 10n;
        let resetCount = 0;

        if (xRange) {
            x = xRange.xMin;
            y = xRange.xMin;
        }

        console.log(`Worker ${workerId + 1} を実行: fx = ${fxEquation}, 試行上限 ${MAX_TRIALS[fxType]}, c = ${c} (範囲: 1 ～ ${maxC * 2 - 1}), x範囲: ${xRange ? xRange.xMin + ' ～ ' + xRange.xMax : '未指定'}`);
        
        x = fxFunction(x, c, n);
        y = fxFunction(fxFunction(y, c, n), c, n);

        while (d === 1n && trialCount < MAX_TRIALS[fxType]) {
            let ys = y;
            for (let i = 0n; i < m && trialCount < MAX_TRIALS[fxType]; i++) {
                y = fxFunction(fxFunction(y, c, n), c, n);
                q = abs(x - y) * q % n;
                trialCount++;

                if (q === 0n) {
                    console.error(`worker ${workerId + 1} q が 0 になりました。（リセット回数: ${resetCount}）`);
                    q = 1n;
                    resetCount++;
                }

                if (trialCount % 1000000n === 0n) {
                    console.log(`worker ${workerId + 1} 試行 ${trialCount}, fx = ${fxEquation}, x=${x}, y=${y}, c = ${c}, q=${q}, gcd=${d}`);
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
            
            setTimeout(() => {
                postMessage({ factor: d.toString(), trials: trialCount.toString(), workerId });
            }, 0);
            
            return;
        }

        console.log(`worker ${workerId + 1} が試行上限 ${MAX_TRIALS[fxType]} に達したため停止`);
        postMessage({ stopped: true, workerId });

    } catch (error) {
        console.error(`worker ${workerId + 1} でエラー: ${error.stack}`);
        postMessage({ error: error.stack, workerId });
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
