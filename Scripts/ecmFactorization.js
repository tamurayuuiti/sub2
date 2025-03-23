// ミラー・ラビン素数判定法
import { isPrimeMillerRabin } from './millerRabin.js';

export async function ecmFactorization(number) {
    if (typeof number !== "bigint") {
        throw new TypeError(`エラー: ecmFactorization() に渡された number (${number}) が BigInt ではありません。`);
    }
    
    let factors = [];
    console.log(`===== ECM 因数分解開始: ${number} =====`);
    
    while (number > 1n) {
        console.log(`現在の数: ${number}`);

        if (isPrimeMillerRabin(number)) {
            console.log(`✅ 素因数を発見: ${number}`);
            factors.push(number);
            break;
        }
        
        let factor = null;

        // ✅ CPU コア数を取得し、並列数を動的に設定
        const cpuCores = navigator.hardwareConcurrency || 4;
        console.log(`⚡ 並列 ECM 試行数: ${cpuCores}`);

        while (!factor || factor === number) {
            console.log(`🔄 ECM を試行: ${number}`);
            
            const attempts = Array.from({ length: cpuCores }, (_, i) => {
                console.log(`🔹 並列試行 ${i + 1}`);
                return ecm(number);  // ✅ `await` を使った非同期 `ecm()`
            });

            factor = (await Promise.all(attempts)).find(f => f && f !== number);
            
            if (!factor) {
                console.error(`❌ ECM では因数を発見できませんでした。`);
                return null;
            }
        }
        
        console.log(`✅ 見つかった因数: ${factor}`);
        
        if (isPrimeMillerRabin(factor)) {
            console.log(`🔹 ${factor} は素数`);
            factors.push(factor);
        } else {
            console.log(`🔄 ${factor} は合成数 → さらに分解`);
            let subFactors = await ecmFactorization(factor);
            if (subFactors.includes("FAIL")) return ["FAIL"];
            factors = factors.concat(subFactors);
        }
        
        number /= factor;
    }

    console.log(`===== 因数分解完了: ${factors} =====`);
    return factors;
}

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
    let maxAttempts = 1000;
    
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
