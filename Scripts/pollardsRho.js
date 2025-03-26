// ミラー・ラビン素数判定法
import { isPrimeMillerRabin } from './millerRabin.js';

export async function pollardsRhoFactorization(number) {
    if (typeof number !== "bigint") {
        throw new TypeError(`エラー: pollardsRhoFactorization() に渡された number (${number}) が BigInt ではありません。`);
    }

    let factors = [];
    while (number > 1n) {
        if (isPrimeMillerRabin(number)) {
            console.log(`素因数を発見: ${number}`);
            factors.push(number);
            break;
        }

        let factor = null;
        while (!factor || factor === number) {
            console.log(`Pollard's rho を試行: ${number}`);
            factor = await pollardsRho(number);

            if (factor === null) {
                console.error(`Pollard's Rho では因数を発見できませんでした。`);
                return ["FAIL"];
            }
        }

        console.log(`見つかった因数: ${factor}`);

        if (isPrimeMillerRabin(factor)) {
            factors.push(factor);
        } else {
            console.log(`合成数を発見: ${factor} → さらに分解`);
            let subFactors = await pollardsRhoFactorization(factor);
            if (subFactors.includes("FAIL")) return ["FAIL"];
            factors = factors.concat(subFactors);
        }

        number /= factor;
    }
    return factors;
}

export async function pollardsRho(n) {
    let attempt = 0;

    while (true) {
        let { k, fxFunction, fxFunctionString, digitCount, MAX_TRIALS } = getDigitBasedParams(n, attempt);
        let trialCount = 0n;
        let x = 2n, y = 2n, d = 1n;
        let m = 128n, q = 1n;
        let c = getRandomC(n, attempt);

        console.log(`試行 ${attempt + 1} 回目: 使用中の f(x) = ${fxFunctionString}, MAX_TRIALS = ${MAX_TRIALS}`);

        if (digitCount >= 21 && attempt >= 3) {
            console.log(`試行 ${attempt + 1} 回目: Pollard's Rho では因数を発見できませんでした。`);
            return null
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
                    console.log(`エラー: q が 0 になりました。`);
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
            console.log(`因数を発見: ${d} (試行回数: ${trialCount})`);
            return d;
        }

        console.log(`試行回数 ${MAX_TRIALS} 回を超過。c を変更して再試行 (${attempt + 1}回目)`);
        attempt++;
    }
}

export function getDigitBasedParams(n, attempt = 0) {
    let digitCount = Math.floor(Math.log10(Number(n))) + 1;

    // `k` の値（GCD 計算頻度）
    let k = digitCount <= 20 ? 10n 
          : digitCount <= 30 ? 15n 
          : 25n;

    // `maxC` の範囲（`c` の最大値）
    let maxC = digitCount <= 20 ? 30
             : 50;

    // `MAX_TRIALS` の設定（試行回数）
    let MAX_TRIALS;
    let fxFunction;
    let fxFunctionString;

    if (digitCount <= 20) {  
        // ✅ 10桁以下のものは削除し、20桁以下と統合
        fxFunction = (x, c, n) => (((x + c) * (x + c) + c) % n);
        fxFunctionString = "((x + c)² + c) % n";
        MAX_TRIALS = 1000000;
    } else {
        if (attempt === 0) {
            fxFunction = (x, c, n) => ((x * x + 7n * x + c)% n);
            fxFunctionString = "(x² + 7x + c) % n";
            MAX_TRIALS = 500000;
        } else if (attempt === 1) {
            fxFunction = (x, c, n) => ((x * x + c * x) % n);
            fxFunctionString = "(x² + cx) % n";
            MAX_TRIALS = 3000000;
        } else if (attempt === 2) {
            fxFunction = (x, c, n) => (x * x * x + x + c) % n;
            fxFunctionString = "(x³ + c) % n";
            MAX_TRIALS = 5000000;
        } else {
            fxFunction = null;
            fxFunctionString = "別の因数分解関数に移行";
            MAX_TRIALS = 0;
        }
    }

    return { digitCount, k, maxC, fxFunction, fxFunctionString, MAX_TRIALS };
}

export　function getRandomC(n, attempt = 0) {
    let { maxC, fxFunctionString } = getDigitBasedParams(n, attempt);
    let c = BigInt((Math.floor(Math.random() * maxC) * 2) + 1);

    console.log(`試行 ${attempt + 1} 回目: 使用中の c = ${c} (範囲: 1 ～ ${maxC * 2 - 1})`);

    return c;
}

export function f(x, n, c) {
    let { fxFunction } = getDigitBasedParams(n);
    return fxFunction(x, c, n);
}

export function gcd(a, b) {
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

export function abs(n) {
    return n < 0n ? -n : n;
}
