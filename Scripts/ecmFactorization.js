// ミラー・ラビン素数判定法
import { isPrimeMillerRabin } from './millerRabin.js';

const MAX_RECURSION_DEPTH = 50;  // 再帰の最大深さ

export async function ecmFactorization(number, depth = 0) {
    if (typeof number !== "bigint") {
        throw new TypeError(`エラー: ecmFactorization() に渡された number (${number}) が BigInt ではありません。`);
    }
    if (depth > MAX_RECURSION_DEPTH) {
        console.error("❌ 最大再帰回数に達しました！");
        return ["FAIL"];
    }

    let factors = [];
    console.log(`===== ECM 因数分解開始: ${number} =====`);

    while (number > 1n) {
        console.log(`現在の数: ${number}`);

        if (isPrimeMillerRabin(number)) {
            console.log(`✅ 素因数を発見: ${number}`);
            factors.push(number);
            break;
        }

        const cpuCores = navigator.hardwareConcurrency || 4;
        console.log(`⚡ Web Worker 並列 ECM 試行数: ${cpuCores}`);

        let factor = null;
        let workers = new Array(cpuCores);
        let workerPromises = [];

        try {
            for (let i = 0; i < cpuCores; i++) {
                workers[i] = new Worker("./Scripts/ecmWorker.js");
                workerPromises.push(
                    new Promise((resolve) => {
                        workers[i].onmessage = (event) => {
                            if (event.data.type === "result") {
                                resolve(event.data.factor ? BigInt(event.data.factor) : null);
                            }
                            workers[i].terminate();
                        };
                        workers[i].postMessage({ number: number.toString(), seed: i });
                    })
                );
            }

            const results = await Promise.all(workerPromises);
            factor = results.find(f => f && f !== number);
        } catch (error) {
            console.error(`❌ Worker エラー: ${error.message}`);
        } finally {
            workers.forEach(worker => worker?.terminate());
        }

        if (!factor) {
            console.error(`❌ ECM では因数を発見できませんでした。`);
            return ["FAIL"];
        }

        console.log(`✅ 見つかった因数: ${factor}`);

        if (isPrimeMillerRabin(factor)) {
            factors.push(factor);
        } else {
            let subFactors = await ecmFactorization(factor, depth + 1);
            if (subFactors.includes("FAIL")) return ["FAIL"];
            factors = factors.concat(subFactors);
        }

        number /= factor;
    }

    console.log(`===== 因数分解完了: ${factors} =====`);
    return factors;
}
