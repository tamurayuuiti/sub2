// ミラー・ラビン素数判定法
import { isPrimeMillerRabin } from './millerRabin.js';

// どの f(x) を使用するか制御するオブジェクト
const ENABLE_FX = {
    fx1: true,  // (3x² + 7x + c) % n
    fx2: true   // (x³ + 5x + c) % n
};

// CPU コア数に基づいて Worker 数を決定
const MAX_WORKERS = navigator.hardwareConcurrency * 1.5 || 4;
const workerFx2Pool = [];
let workerFx1 = null;

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
        let activeWorkers = 0;

        if (!ENABLE_FX.fx1 && !ENABLE_FX.fx2) {
            console.error(`全ての f(x) が無効です。少なくとも 1 つ有効にしてください。`);
            resolve(null);
            return;
        }

        // fx1 の Worker を作成
        if (ENABLE_FX.fx1) {
            workerFx1 = new Worker("./Scripts/worker.js");
            activeWorkers++;
            workerFx1.postMessage({ n, fxType: 'fx1', workerId: 0 });

            workerFx1.onmessage = function (event) {
                handleWorkerMessage(event, 'fx1', workerFx1, resolve);
            };
        }

        // fx2 の Worker を作成
        if (ENABLE_FX.fx2) {
            for (let i = 1; i < MAX_WORKERS; i++) {
                const worker = new Worker("./Scripts/worker.js");
                workerFx2Pool.push(worker);
                activeWorkers++;
                worker.postMessage({ n, fxType: 'fx2', workerId: i });

                worker.onmessage = function (event) {
                    handleWorkerMessage(event, 'fx2', worker, resolve);
                };
            }
        }

        function handleWorkerMessage(event, fxType, worker, resolve) {
            console.log(`受信データ:`, event.data);

            if (event.data.error) {
                console.error(`worker でエラー発生: ${event.data.error}`);
                return;
            }

            if (event.data.factor) {
                try {
                    let factor = BigInt(event.data.factor);
                    console.log(`worker が因数 ${factor} を発見（試行回数: ${BigInt(event.data.trials)}）`);
                    
                    // すべての worker を停止
                    workerFx1?.terminate();
                    workerFx2Pool.forEach(w => w.terminate());

                    resolve(factor);
                } catch (error) {
                    console.error(`BigInt 変換エラー: ${error.message}`);
                }
            }

            if (event.data.stopped) {
                console.log(`worker が試行上限に達し停止`);
                worker.terminate();
                activeWorkers--;

                // fx1 の Worker を fx2 用に再利用
                if (fxType === 'fx1') {
                    workerFx2Pool.push(worker);
                }

                if (activeWorkers === 0) {
                    console.log(`すべての worker が停止しました。因数を発見できませんでした。`);
                    resolve(null);
                }
            }
        }
    });
}
