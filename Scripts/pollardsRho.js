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
    return new Promise((resolve, reject) => {
        const totalWorkers = navigator.hardwareConcurrency - 2|| 4; // デフォルト4
        const numFx1Workers = 1; // fx1用 workerは1つ
        const numFx2Workers = totalWorkers - 1; // 残りを fx2 に割り当てる

        const workers = [];
        let activeWorkers = totalWorkers;

        function createWorker(fxType, workerId) {
            try {
                const worker = new Worker("./Scripts/worker.js");
                workers.push(worker);
                worker.postMessage({ n, fxType, workerId });

                worker.onmessage = function (event) {
                    console.log(`受信データ:`, event.data);

                    if (event.data.error) {
                        console.error(`worker ${workerId} でエラー発生: ${event.data.error}`);
                        return;
                    }

                    if (event.data.factor) {
                        try {
                            let factor = BigInt(event.data.factor);
                            console.log(`worker ${workerId} が因数 ${factor} を発見（試行回数: ${BigInt(event.data.trials)}）`);
                            workers.forEach((w) => w.terminate());
                            resolve(factor);
                        } catch (error) {
                            console.error(`BigInt 変換エラー: ${error.message}`);
                        }
                    }

                    if (event.data.stopped) {
                        console.log(`worker ${workerId} が試行上限に達し停止`);
                        worker.terminate();
                        activeWorkers--;

                        if (activeWorkers === 0) {
                            console.log(`すべての worker が停止しました。因数を発見できませんでした。`);
                            resolve(null);
                        }
                    }
                };

                worker.onerror = function (error) {
                    console.error(`worker ${workerId} でエラー発生: ${error.message}`);
                    reject(error);
                };
            } catch (error) {
                console.error(`worker ${workerId} の作成に失敗しました。 ${error.message}`);
                reject(error);
            }
        }

        // fx1 用 worker を 1 つ作成
        createWorker("fx1", 0);
        
        // fx2 用 worker を numFx2Workers 分作成
        for (let i = 1; i <= numFx2Workers; i++) {
            createWorker("fx2", i);
        }
    });
}
