self.onmessage = async function(event) {
    try {
        let { n, fxType, workerId, initialX } = event.data;
        let { maxC } = getDigitBasedParams(n);
        let c = getRandomC(n, maxC);
        let fxFunction;
        let fxEquation;

        const MAX_TRIALS = {
            fx1: 300000n,
            fx2: 100000000n
        };

        if (fxType === "fx1") { //試験用関数。現在は未使用
            fxEquation = "(3x² + 7x + c) mod n";
            fxFunction = (x, c, n) => (3n * x * x + 7n * x + c) % n;
        } else if (fxType === "fx2") {
            fxEquation = "(x³ + 5x + c) mod n";
            fxFunction = (x, c, n) => (x * x * x + 5n * x + c) % n;
        } else {
            throw new Error("Unknown fxType");
        }

        console.log(`Worker ${workerId + 1} を実行: fx = ${fxEquation}, 初期 x = ${initialX}, 試行上限 ${MAX_TRIALS[fxType]}, c = ${c}`);

        let x = initialX, y = initialX, d = 1n;
        let trialCount = 0n;
        let q = 1n;
        let m = 128n;
        let k = 20n;
        let resetCount = 0;

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
                    console.log(`worker ${workerId + 1} 試行 ${trialCount}, x=${x}, y=${y}, c=${c}, q=${q}, m=${m}, k=${k} gcd=${d}`);
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
                k = 10n + m / 10n;
            }
        }

        if (d > 1n && d !== n) {
            console.log(`worker ${workerId + 1} が因数 ${d} を送信（試行回数: ${trialCount}）`);

            setTimeout(() => {
                postMessage({ factor: d.toString(), trials: trialCount.toString() });
            }, 0);

            return;
        }

        console.log(`worker ${workerId + 1} が試行上限に達したため停止`);
        postMessage({ stopped: true });

    } catch (error) {
        console.error(`worker ${workerId + 1} でエラー発生: ${error.stack}`);
        postMessage({ error: error.stack });
    }
};

function getDigitBasedParams(n) {
    let digitCount = (n === 0n) ? 1 : (n.toString(2).length * 0.30103) | 0;
    let maxC;
    
    if (digitCount <= 10) {
        maxC = 20;
    } else if (digitCount <= 20) {
        maxC = 35;
    } else if (digitCount <= 24) {
        maxC = 50;
    } else if (digitCount <= 28) {
        maxC = 65;
    } else {
        maxC = 80;
    }

    return { maxC };
}

function getRandomC(n, maxC) {
    return BigInt(Math.floor(Math.random() * maxC)) * 2n + 1n;
}

function gcd(a, b) {
    if (a === 0n) return b;
    if (b === 0n) return a;

    while (b !== 0n) {
        [a, b] = [b, a % b];
    }
    return a;
}

function abs(n) {
    if (n < 0n) return -n;
    return n;
}
