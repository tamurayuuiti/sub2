// ミラー・ラビン素数判定法
import { isPrimeMillerRabin } from './millerRabin.js';

// どの f(x) を使用するか制御するオブジェクト
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
        const cpuCores = navigator.hardwareConcurrency || 4; // デフォルト 4
        const totalWorkers = Math.max(2, cpuCores); // 最低 2 つの Worker
        const fx1Workers = 1;
        const fx2Workers = totalWorkers - fx1Workers;
        let activeWorkers = totalWorkers;

        const workerConfigs = [];
        workerConfigs.push({ fxType: "fx1", xStart: 2n }); // fx1 の Worker
        for (let i = 0; i < fx2Workers; i++) {
            workerConfigs.push({ fxType: "fx2", xStart: BigInt([2, 3, 5, 7, 11][i % 5]) });
        }

        for (let i = 0; i < totalWorkers; i++) {
            try {
                const worker = new Worker("./Scripts/worker.js");
                workers.push(worker);
                
                worker.postMessage({
                    n,
                    fxType: workerConfigs[i].fxType,
                    workerId: i,
                    xStart: workerConfigs[i].xStart
                });
                
                worker.onmessage = function (event) {
                    console.log(`受信データ:`, event.data);
                    
                    if (event.data.error) {
                        console.error(`worker ${i + 1} でエラー発生: ${event.data.error}`);
                        return;
                    }
                    
                    if (event.data.factor) {
                        try {
                            let factor = BigInt(event.data.factor);
                            console.log(`worker ${i + 1} が因数 ${factor} を発見`);
                            workers.forEach((w) => w.terminate());
                            resolve(factor);
                        } catch (error) {
                            console.error(`BigInt 変換エラー: ${error.message}`);
                        }
                    }
                    
                    if (event.data.stopped) {
                        console.log(`worker ${i + 1} が停止`);
                        worker.terminate();
                        activeWorkers--;
                        
                        if (activeWorkers === 0) {
                            console.log(`すべての worker が終了。因数を発見できませんでした。`);
                            resolve(null);
                        }
                    }
                };

                worker.onerror = function (error) {
                    console.error(`worker ${i + 1} でエラー: ${error.message}`);
                    reject(error);
                };
            } catch (error) {
                console.error(`worker ${i + 1} の作成失敗: ${error.message}`);
                reject(error);
            }
        }
    });
}

