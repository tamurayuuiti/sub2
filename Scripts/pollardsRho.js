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
    return new Promise((resolve) => {
        const workers = [];
        const fxTypes = ["fx1", "fx2", "fx3", "fx4"];
        let resolved = false;

        for (let i = 0; i < 4; i++) {
            const worker = new Worker("worker.js");
            workers.push(worker);

            let x = 2n;
            let c = getRandomC(n, i);

            worker.postMessage({ x, c, n, fxType: fxTypes[i] });

            worker.onmessage = function (event) {
                if (resolved) return;

                if (event.data.factor && event.data.factor !== n) {
                    resolved = true;
                    console.log(`Worker ${i + 1} が因数 ${event.data.factor} を発見！ (試行回数: ${event.data.trials})`);
                    workers.forEach((w) => w.terminate()); // すべての Worker を停止
                    resolve(event.data.factor);
                }
            };
        }
    });
}

export function getRandomC(n, attempt = 0) {
    let { maxC } = getDigitBasedParams(n, attempt);
    let c = BigInt((Math.floor(Math.random() * maxC) * 2) + 1);

    console.log(`試行 ${attempt + 1} 回目: 使用中の c = ${c} (範囲: 1 ～ ${maxC * 2 - 1})`);

    return c;
}
