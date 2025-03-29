// ミラー・ラビン素数判定法
import { isPrimeMillerRabin } from './millerRabin.js';

const ENABLE_FX = {
    fx1: true,  // (3x² + 7x + c) % n
    fx2: true   // (x³ + 5x + c) % n
};

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

// pollardsRho.js
// pollardsRho.js
export async function pollardsRho(n) {
    return new Promise((resolve, reject) => {
        const numWorkers = navigator.hardwareConcurrency || 4; // CPU コア数
        const workers = [];
        let activeWorkers = numWorkers;

        const rangeSize = n / BigInt(numWorkers);
        
        for (let i = 0; i < numWorkers; i++) {
            try {
                const worker = new Worker("./Scripts/worker.js");
                workers.push(worker);

                const xStart = i * rangeSize;
                const xEnd = (i + 1) * rangeSize;

                worker.postMessage({
                    n,
                    fxType: 'fx2',
                    workerId: i,
                    xStart: xStart.toString(),
                    xEnd: xEnd.toString(),
                });

                worker.onmessage = function (event) {
                    if (event.data.error) {
                        console.error(`worker ${i} でエラー発生: ${event.data.error}`);
                        return;
                    }

                    if (event.data.factor) {
                        let factor = BigInt(event.data.factor);
                        console.log(`worker ${i} が因数 ${factor} を発見`);
                        workers.forEach(w => w.terminate());
                        resolve(factor);
                    }

                    if (event.data.stopped) {
                        worker.terminate();
                        activeWorkers--;
                        if (activeWorkers === 0) {
                            console.log(`すべての worker が終了しました。因数を発見できませんでした。`);
                            resolve(null);
                        }
                    }
                };

                worker.onerror = function (error) {
                    console.error(`worker ${i} でエラー発生: ${error.message}`);
                    reject(error);
                };
            } catch (error) {
                console.error(`worker ${i} の作成に失敗しました。${error.message}`);
                reject(error);
            }
        }
    });
}
