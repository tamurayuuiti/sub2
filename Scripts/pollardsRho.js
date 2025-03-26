// ミラー・ラビン素数判定法
import { isPrimeMillerRabin } from './millerRabin.js';

const ENABLE_FX = {
    fx1: true,
    fx2: true,
    fx3: true
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
            try {
                factor = await pollardsRho(number);
            } catch (error) {
                console.error(`Pollard's Rho の実行中にエラー: ${error.message}`);
                return ["FAIL"];
            }

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
        const fxTypes = Object.keys(ENABLE_FX).filter(fx => ENABLE_FX[fx]); 
        let activeWorkers = Math.min(fxTypes.length, navigator.hardwareConcurrency);

        if (activeWorkers === 0) {
            console.error(`全ての f(x) が無効です。少なくとも 1 つ有効にしてください。`);
            resolve(null);
            return;
        }

        for (let i = 0; i < fxTypes.length; i++) {
            try {
                const worker = new Worker("./Scripts/Worker.js");
                workers[i] = worker;
                console.log(`Worker ${i + 1} (${fxTypes[i]}) を作成しました。`);

                setTimeout(() => {
                    console.log(`Worker ${i + 1} (${fxTypes[i]}) の実行を開始`);
                    worker.postMessage({ n, fxType: fxTypes[i] });
                }, 5);

                worker.onmessage = function (event) {
                    console.log(`受信データ:`, event.data);

                    iif (event.data.test) {
                        console.log(`[実験成功] Worker ${fxTypes[i]} から仮の因数 ${event.data.factor} を受信！`);
                        return;  // 実験用なので処理を続行
                    }
                    
                    if (event.data.error) {
                        console.error(`Worker ${i + 1} (${fxTypes[i]}) でエラー発生: ${event.data.error}`);
                        return;
                    }

                    if (event.data.factor) {
                        try {
                            let factor = BigInt(event.data.factor);
                            console.log(`Worker ${i + 1} (${fxTypes[i]}) が因数 ${factor} を発見！（試行回数: ${BigInt(event.data.trials)}）`);
                            workers.forEach((w, index) => {
                                if (w) {
                                    w.terminate();
                                    workers[index] = null;
                                }
                            });
                            resolve(factor);
                        } catch (error) {
                            console.error(`BigInt 変換エラー: ${error.message}`);
                        }
                    }

                    if (event.data.stopped) {
                        console.log(`Worker ${i + 1} (${fxTypes[i]}) が試行上限に達し停止`);
                        worker.terminate();
                        workers[i] = null;
                        activeWorkers--;

                        if (activeWorkers === 0) {
                            console.log(`すべての Worker が停止しました。因数を発見できませんでした。`);
                            resolve(null);
                        }
                    }
                };

                worker.onerror = function (error) {
                    console.error(`Worker ${i + 1} でエラー発生: ${error.message}`);
                    resolve(null);
                };

            } catch (error) {
                console.error(`Worker ${i + 1} の作成に失敗しました: ${error.message}`);
                resolve(null);
            }
        }
    });
}
