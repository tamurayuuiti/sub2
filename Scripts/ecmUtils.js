export async function ecm(n) {
    let attempt = 0;
    while (true) {
        let { a, B1, maxAttempts } = getECMParams(n, attempt);
        let x = getRandomX(n);
        let y = ((x * x * x + a * x + getRandomX(n)) * getRandomX(n)) % n;
        let P = { x, y };
        
        console.log(`🟢 試行 ${attempt + 1}: a = ${a}, P = (${x}, ${y}), B1 = ${B1}`);
        
        let factor = ECM_step(n, P, a, B1);
        
        if (factor > 1n && factor !== n) {
            console.log(`✅ 試行 ${attempt + 1} で因数発見: ${factor}`);
            return factor;
        }
        
        attempt++;
        if (attempt >= maxAttempts) {
            console.log(`❌ 最大試行回数 ${maxAttempts} に達したため終了`);
            return null;
        }
    }
}

export function getECMParams(n, attempt = 0) {
    let logN = BigInt(n.toString().length);  
    let baseB1 = 10n ** (logN / 3n);
    let adaptiveB1 = baseB1 * (BigInt(attempt) + 1n);
    let maxB1 = 10n ** 7n;
    let minB1 = 10n ** 5n;
    let B1 = adaptiveB1 > maxB1 ? maxB1 : (adaptiveB1 < minB1 ? minB1 : adaptiveB1);
    let a = (getRandomX(n) * getRandomX(n) + getRandomX(n) + 1n) % n;
    let maxAttempts = 500;
    
    console.log(`⚙️ ECM パラメータ: a=${a}, B1=${B1}, maxAttempts=${maxAttempts}`);
    
    return { a, B1, maxAttempts };
}

export async function ECM_step(n, P, a, B1) {
    let x = P.x;
    let y = P.y;
    let gcdValue = 1n;
    let maxB1 = 10n ** 7n;
    let actualB1 = B1 > maxB1 ? maxB1 : B1;

    console.log(`🔄 ECM_step 開始: B1=${actualB1}`);

    for (let k = 2n; k <= actualB1; k++) {
        let kModN = k % n;
        
        let newX = (x * x - a) % n;
        let newY = (y * y - 1n) % n;
        P.x = newX;
        P.y = newY;

        let z = abs(P.x);
        gcdValue = gcd(z, n);

        if (gcdValue > 1n && gcdValue !== n) {
            console.log(`✅ GCD(${z}, ${n}) = ${gcdValue} → 因数発見`);
            return gcdValue;
        }

        if (k % (actualB1 / 100n) === 0n) {
            console.log(`⚠️ k=${k}: GCD(z, n) はまだ 1`);
        }

        // ✅ `await` を入れて他の処理と並列化
        if (k % 1000n === 0n) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    console.log(`❌ ECM_step 失敗`);
    return 1n;
}

export function getRandomX(n) {
    let randArray = new Uint32Array(2);
    crypto.getRandomValues(randArray);
    let randNum = (BigInt(randArray[0]) << 32n) | BigInt(randArray[1]);
    return (randNum % (n - 2n)) + 1n;
}

export function gcd(a, b) {
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

export function abs(n) {
    return n < 0n ? -n : n;
}
