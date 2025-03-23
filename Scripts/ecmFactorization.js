// ミラー・ラビン素数判定法
import { isPrimeMillerRabin } from './millerRabin.js';

// ECMによる素因数分解
export async function ecmFactorization(number) {
    if (typeof number !== "bigint") {
        throw new TypeError(`エラー: ecmFactorization() に渡された number (${number}) が BigInt ではありません。`);
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
            console.log(`ECM を試行: ${number}`);
            factor = await ecm(number);

            if (factor === null) {
                console.error(`ECM では因数を発見できませんでした。`);
                return ["FAIL"];
            }
        }

        console.log(`見つかった因数: ${factor}`);

        if (isPrimeMillerRabin(factor)) {
            factors.push(factor);
        } else {
            console.log(`合成数を発見: ${factor} → さらに分解`);
            let subFactors = await ecmFactorization(factor);
            if (subFactors.includes("FAIL")) return ["FAIL"];
            factors = factors.concat(subFactors);
        }

        number /= factor;
    }
    return factors;
}

// ECM のメイン処理
export async function ecm(n) {
    let attempt = 0;

    while (true) {
        let { a, B1, maxAttempts } = getECMParams(n, attempt);
        let x = getRandomX(n);
        let y = (x * x * x + a * x) % n;
        let P = { x, y };

        console.log(`試行 ${attempt + 1} 回目: a = ${a}, P = (${x}, ${y}), B1 = ${B1}`);

        let factor = ECM_step(n, P, a, B1);

        if (factor > 1n && factor !== n) {
            console.log(`因数を発見: ${factor}`);
            return factor;
        }

        console.log(`試行回数 ${maxAttempts} 回を超過。新しいパラメータで再試行 (${attempt + 1}回目)`);
        attempt++;
        if (attempt >= maxAttempts) return null;
    }
}

// ECM のステップ（スカラー倍 + GCD 計算）
export function ECM_step(n, P, a, B1) {
    let x = P.x;
    let y = P.y;
    let gcdValue = 1n;

    for (let k = 2n; k <= B1; k++) {
        let newX = (x * k) % n;
        let newY = (y * k) % n;
        let z = (newX - newY) % n;

        gcdValue = gcd(abs(z), n);
        if (gcdValue > 1n && gcdValue !== n) {
            return gcdValue;
        }
    }
    return 1n;
}

// ECM のパラメータを取得
export function getECMParams(n, attempt = 0) {
    let B1 = attempt < 2 ? 1000n : 5000n;  // B1 の値を動的に変更
    let a = (BigInt(attempt) * 3n + 1n) % n;
    let maxAttempts = 1000;

    return { a, B1, maxAttempts };
}

// ランダムな x 座標を取得
export function getRandomX(n) {
    return BigInt(Math.floor(Math.random() * Number(n - 2n))) + 1n;
}
