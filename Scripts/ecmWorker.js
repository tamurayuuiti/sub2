console.log(`利用可能なスレッド数: ${navigator.hardwareConcurrency}`);

self.onmessage = async function(event) {
    try {
        const number = BigInt(event.data);
        postLog(`🔄 Worker: ECM 実行開始 (${number})`);

        const factor = await ecm(number, postLog);

        postMessage({ type: "result", factor: factor ? factor.toString() : "null" });

    } catch (error) {
        postLog(`❌ Worker: エラー発生 - ${error.message}`);
        postMessage({ type: "result", factor: "null" });
    }
};

// ✅ ログをメインスレッドに送信する関数
function postLog(message) {
    self.postMessage({ type: "log", message });
}

// ✅ `ecm()` を Worker に統合！
async function ecm(n, logCallback = postLog) {
    let attempt = 0;
    logCallback(`🟢 ECM を開始: n=${n}`);

    while (true) {
        logCallback(`🔄 ECM: 試行 ${attempt + 1} を開始`);

        let { a, B1, maxAttempts } = getECMParams(n, attempt, logCallback);
        logCallback(`⚙️ ECMパラメータ: a=${a}, B1=${B1}, maxAttempts=${maxAttempts}`);

        let x = getRandomX(n);
        let y = ((x * x * x + a * x + getRandomX(n)) * getRandomX(n)) % n;
        let P = { x, y };

        logCallback(`🟢 試行 ${attempt + 1}: P=(${x}, ${y}), B1=${B1}`);

        let factor = await ECM_step(n, P, a, B1, logCallback);
        logCallback(`📢 ECM_step() の返り値: ${factor}`);

        if (factor > 1n && factor !== n) {
            logCallback(`✅ 試行 ${attempt + 1} で因数発見: ${factor}`);
            return factor;
        }

        attempt++;
        if (attempt >= maxAttempts) {
            logCallback(`❌ 最大試行回数 ${maxAttempts} に達したため終了`);
            return null;
        }

        await new Promise(resolve => setTimeout(resolve, 0));  // フリーズ防止
    }
}

// ✅ Worker 内に `ECM_step()` を統合
async function ECM_step(n, P, a, B1, logCallback = postLog) {
    logCallback(`🚀 ECM_step() 開始: n=${n}, B1=${B1}`);

    let x = P.x;
    let y = P.y;
    let gcdValue = 1n;
    let maxB1 = 10n ** 7n;
    let actualB1 = B1 > maxB1 ? maxB1 : B1;

    for (let k = 2n; k <= actualB1; k++) {
        let newX = (x * x - a) % n;
        let newY = (y * y - 1n) % n;
        P.x = newX;
        P.y = newY;

        let z = abs(P.x);
        gcdValue = gcd(z, n);

        if (gcdValue > 1n && gcdValue !== n) {
            logCallback(`✅ GCD(${z}, ${n}) = ${gcdValue} → 因数発見`);
            return gcdValue;
        }

        if (k % 10000n === 0n) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    logCallback(`❌ ECM_step 失敗`);
    return 1n;
}

// ✅ その他の関数も統合
function getECMParams(n, attempt = 0, logCallback = postLog) {
    let logN = BigInt(n.toString().length);  
    let baseB1 = 10n ** (logN / 3n);
    let adaptiveB1 = baseB1 * (BigInt(attempt) + 1n);
    let maxB1 = 10n ** 7n;
    let minB1 = 10n ** 5n;
    let B1 = adaptiveB1 > maxB1 ? maxB1 : (adaptiveB1 < minB1 ? minB1 : adaptiveB1);
    let a = (getRandomX(n) * getRandomX(n) + getRandomX(n) + 1n) % n;
    let maxAttempts = 500;

    logCallback(`⚙️ ECMパラメータ: a=${a}, B1=${B1}, maxAttempts=${maxAttempts}`);

    if (B1 === 0n) {
        throw new Error("🚨 B1 が 0 になっています！ECM が動きません！");
    }

    return { a, B1, maxAttempts };
}

function getRandomX(n) {
    let randArray = new Uint32Array(2);
    crypto.getRandomValues(randArray);
    let randNum = (BigInt(randArray[0]) << 32n) | BigInt(randArray[1]);
    return (randNum % (n - 2n)) + 1n;
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
