self.onmessage = async function(event) {
    try {
        let { n, workerId, initialX, mMultiplier } = event.data;
        let { maxC } = getDigitBasedParams(n);
        let c = getRandomC(n, maxC);

        const MAX_TRIALS = 100000000n;

        const fxEquation = "(x³ + 5x + c) mod n";
        const fxFunction = (x, c, n) => (x * x * x + x + c) % n;

        let mRatio = (Number(mMultiplier) / 100).toFixed(2);
        console.log(`worker ${workerId + 1} 実行: fx = ${fxEquation}, 初期ｘ = ${initialX}, ｍ増加率 = ${mRatio}, 試行上限 ${MAX_TRIALS}`);


        let x = initialX, y = initialX, d = 1n;
        let trialCount = 0n;
        let q = 1n;
        let m = 128n;
        let k = 10n;
        let resetCount = 0;

        x = fxFunction(x, c, n);
        y = fxFunction(fxFunction(y, c, n), c, n);
        
        while (d === 1n && trialCount < MAX_TRIALS) {
            let ys = y;
            for (let i = 0n; i < m && trialCount < MAX_TRIALS; i++) {
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
                m = (m * mMultiplier) / 100n;
            }
        }

        if (d > 1n && d !== n) {
            console.log(`worker ${workerId + 1} が因数 ${d} を送信（試行回数: ${trialCount}）`);
            postMessage({ factor: d.toString(), trials: trialCount.toString() });
        } else {
            console.log(`worker ${workerId + 1} が試行上限に達したため停止`);
            postMessage({ stopped: true });
        }

    } catch (error) {
        console.error(`worker ${workerId + 1} でエラー発生: ${error.stack}`);
        postMessage({ error: error.stack });
    }
};

function getDigitBasedParams(n) {
    const digitCount = n.toString(10).length;
    const maxC = Math.min(200, 5 * digitCount + 20); // 線形スケール + 上限200
    return { maxC };
}

function getRandomC(n, maxC) {
    return 17n;
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
    return n < 0n ? -n : n;
}
