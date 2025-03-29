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

export async function pollardsRho(n) {
    return new Promise((resolve, reject) => {
        const workers = [];
        const cpuCount = navigator.hardwareConcurrency || 4;
        const fxTypes = Object.keys(ENABLE_FX).filter(fx => ENABLE_FX[fx]); 
        let activeWorkers = cpuCount;

        if (activeWorkers === 0) {
            console.error(`全ての f(x) が無効です。少なくとも 1 つ有効にしてください。`);
            resolve(null);
            return;
        }

        let workerConfigs = [];
        if (ENABLE_FX.fx1) {
            workerConfigs.push({ fxType: "fx1", x: 2n });
        }
        
        if (ENABLE_FX.fx2) {
            workerConfigs.push({ fxType: "fx2", x: 2n });
            const xValues = [3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n];
            for (let i = workerConfigs.length; i < activeWorkers; i++) {
                let randomX = xValues[Math.floor(Math.random() * xValues.length)];
                workerConfigs.push({ fxType: "fx2", x: randomX });
            }
        }

        workerConfigs.forEach(({ fxType, x }, i) => {
            try {
                const worker = new Worker("./Scripts/worker.js");
                workers.push(worker);

                worker.postMessage({ n, fxType, xStart: x, workerId: i });

                worker.onmessage = function (event) {
                    console.log(`受信データ:`, event.data);

                    if (event.data.error) {
                        console.error(`worker ${i + 1} でエラー発生: ${event.data.error}`);
                        return;
                    }

                    if (event.data.factor) {
                        try {
                            let factor = BigInt(event.data.factor); 
                            console.log(`worker ${i + 1} が因数 ${factor} を発見（試行回数: ${BigInt(event.data.trials)}）`);
                            workers.forEach((w) => w.terminate());
                            resolve(factor);
                        } catch (error) {
                            console.error(`BigInt 変換エラー: ${error.message}`);
                        }
                    }

                    if (event.data.stopped) {
                        console.log(`worker ${i + 1} が試行上限に達し停止`);
                        worker.terminate();
                        activeWorkers--;

                        if (activeWorkers === 0) {
                            console.log(`すべての worker が停止しました。因数を発見できませんでした。`);
                            resolve(null);
                        }
                    }
                };

                worker.onerror = function (error) {
                    console.error(`worker ${i + 1} でエラー発生: ${error.message}`);
                    reject(error);
                };

            } catch (error) {
                console.error(`worker ${i + 1} の作成に失敗しました。 ${error.message}`);
                reject(error);
            }
        });
    });
}
