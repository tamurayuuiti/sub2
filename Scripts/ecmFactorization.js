// ミラー・ラビン素数判定法
import { isPrimeMillerRabin } from './millerRabin.js';

const MAX_RECURSION_DEPTH = 50;
const WORKER_POOL_SIZE = navigator.hardwareConcurrency || 4;  // 利用可能な CPU コア数

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

        let factor = await findFactorWithWorkers(number);

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

// Worker プールを利用して因数を見つける
async function findFactorWithWorkers(number) {
    const workers = new Array(WORKER_POOL_SIZE).fill(null).map(() => new Worker("./Scripts/ecmWorker.js"));
    let workerPromises = [];

    try {
        for (let i = 0; i < WORKER_POOL_SIZE; i++) {
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
        return results.find(f => f && f !== number) || null;
    } catch (error) {
        console.error(`❌ Worker エラー: ${error.message}`);
        return null;
    } finally {
        workers.forEach(worker => worker.terminate());
    }
}
