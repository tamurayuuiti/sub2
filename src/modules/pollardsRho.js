// ミラーラビン素数判定法
import { isPrimeMillerRabin } from "./millerRabin.js";

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

        console.log(`因数を発見: ${factor}`);

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
        const workerCount = getWorkerCount();
        let activeWorkers = workerCount;

        if (activeWorkers === 0) {
            console.error(`使用可能なワーカーがありません。`);
            resolve(null);
            return;
        }

        for (let i = 0; i < workerCount; i++) {
            try {
                const worker = new Worker("./src/modules/worker.js");
                workers.push(worker);

                const initialX = assignX(i, n);
                const mMultiplier = getMMultiplier(i);

                worker.postMessage({ n, workerId: i, initialX, mMultiplier });

                worker.onmessage = function (event) {
                    console.log(`受信データ:`, event.data);

                    if (event.data.error) {
                        console.error(`worker ${i + 1} でエラー発生: ${event.data.error}`);
                        return;
                    }

                    if (event.data.factor) {
                        try {
                            const factor = BigInt(event.data.factor);
                            console.log(`worker ${i + 1} が因数 ${factor} を発見（試行回数: ${BigInt(event.data.trials)}）`);
                            workers.forEach((w) => w.terminate());
                            resolve(factor);
                        } catch (error) {
                            console.error(`BigInt 変換エラー: ${error.message}`);
                        }
                    }

                    if (event.data.stopped) {
                        console.log(`worker ${i + 1} が試行上限に達して停止しました。`);
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
        }
    });
}

// CPU コア数に基づいてワーカー数を決定
function getWorkerCount() {
    const cpuCores = navigator.hardwareConcurrency || 4;

    if (cpuCores <= 8) {
        return Math.max(1, cpuCores - 2);
    } else {
        return Math.max(1, Math.floor(cpuCores * 0.6));
    }
}

function assignX(workerId, n) {
    if (workerId === 0) return 2n;
    if (workerId === 1) return n / 2n;
    return getRandomX(n);
}

function getRandomX(n) {
    return BigInt(Math.floor(Math.random() * Number(n - 2n))) + 2n;
}

function getMMultiplier(workerId) {
    const multipliers = [150n, 175n, 200n];
    return multipliers[workerId % multipliers.length];
}
