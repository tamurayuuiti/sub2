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
        const workers = [];
        const fxTypes = ["fx1", "fx2", "fx3", "fx4"];
        let activeWorkers = fxTypes.length;

        for (let i = 0; i < fxTypes.length; i++) {
            try {
                const worker = new Worker("./Scripts/worker.js");
                workers.push(worker);
                console.log(`✅ Worker ${i + 1} (${fxTypes[i]}) を作成しました。`);

                worker.postMessage({ n, fxType: fxTypes[i], attempt: i });

                worker.onmessage = function (event) {
                    if (event.data.error) {
                        console.error(`❌ Worker ${i + 1} (${fxTypes[i]}) でエラー発生: ${event.data.error}`);
                        return;
                    }

                    if (event.data.factor && event.data.factor !== n) {
                        console.log(`🎯 Worker ${i + 1} (${fxTypes[i]}) が因数 ${event.data.factor} を発見！（試行回数: ${event.data.trials}）`);
                        workers.forEach((w) => w.terminate());
                        resolve(event.data.factor);
                    }

                    if (event.data.stopped) {
                        console.log(`⏹️ Worker ${i + 1} (${fxTypes[i]}) が試行上限に達し停止`);
                        worker.terminate();
                        activeWorkers--;

                        if (activeWorkers === 0) {
                            console.log(`❌ すべての Worker が停止しました。因数を発見できませんでした。`);
                            resolve(null);
                        }
                    }
                };

                worker.onerror = function (error) {
                     console.error(`❌ Worker ${i + 1} でエラー発生: ${error.message}`);
                     reject(error)
                
                } catch (error) {
                    console.error(`🚨 Worker ${i + 1} の作成に失敗しました: ${error.message}`);
                    reject(error);
                }
            }
        });
}
