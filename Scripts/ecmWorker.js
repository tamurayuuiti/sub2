console.log(`利用可能なスレッド数: ${navigator.hardwareConcurrency}`);

self.onmessage = async function(event) {
    try {
        const { number, seed } = event.data;
        const n = BigInt(number);
        postLog(`🔄 Worker: ECM 実行開始 (${n}), seed=${seed}`);

        const factor = await ecm(n, seed, postLog);

        postMessage({ type: "result", factor: factor ? factor.toString() : "null" });

    } catch (error) {
        postLog(`❌ Worker: エラー発生 - ${error.message}`);
        postMessage({ type: "result", factor: "null" });
    }
};

function postLog(message) {
    self.postMessage({ type: "log", message });
}

async function ecm(n, seed, logCallback = postLog) {
    let attempt = 0;

    while (true) {
        let { a, B1, maxAttempts } = getECMParams(n, attempt, seed, logCallback);
        let x = getRandomX(n, seed);
        let y = (x * x * x + a * x + getRandomX(n, seed)) % n;
        let P = { x, y };

        let factor = await ECM_step(n, P, a, B1, logCallback);

        if (factor > 1n && factor !== n) {
            return factor;
        }

        attempt++;
        if (attempt >= maxAttempts) {
            return null;
        }
    }
}

async function ECM_step(n, P, a, B1, logCallback = postLog) {
    let x = P.x, y = P.y;
    let gcdValue = 1n;

    for (let k = 2n; k <= B1; k++) {
        x = (x * x - a) % n;
        y = (y * y - 1n) % n;
        P.x = x;
        P.y = y;

        if (k % 1000n === 0n) {  // 1000 ステップごとに GCD を計算
            let z = abs(P.x);
            gcdValue = gcd(z, n);

            if (gcdValue > 1n && gcdValue !== n) {
                return gcdValue;
            }
        }
    }

    return 1n;
}

function getECMParams(n, attempt, seed, logCallback = postLog) {
    let logN = BigInt(n.toString().length);
    let baseB1 = 10n ** (logN / 4n);  // 増加率を緩やかに
    let adaptiveB1 = baseB1 * BigInt(Math.pow(Number(attempt + 1), 1.5));  // 修正
    let B1 = adaptiveB1 > 10n ** 7n ? 10n ** 7n : adaptiveB1;
    let a = (getRandomX(n, seed) ** 2n + getRandomX(n, seed) + 1n) % n;
    let maxAttempts = 300;

    return { a, B1, maxAttempts };
}

function getRandomX(n, seed) {
    let randArray = new Uint32Array(2);
    crypto.getRandomValues(randArray);
    let randNum = (BigInt(randArray[0]) << 32n) | BigInt(randArray[1]);
    return (randNum + BigInt(seed)) % (n - 2n) + 1n;
}

function gcd(a, b) {
    if (b === 0n) return a;
    if (a === 0n) return b;
    
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
        b %= a;
        if (b === 0n) return a << shift;
    }
    return a << shift;
}

function abs(n) {
    return n < 0n ? -n : n;
}
