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
        const cpuCount = Math.max(2, navigator.hardwareConcurrency || 4); // CPU数 or デフォルト4
        const fx1Workers = 1;
        const fx2Workers = cpuCount - fx1Workers;
        let activeWorkers = fx1Workers + fx2Workers;

        if (activeWorkers === 0) {
            console.error("Workerを作成できません。");
            resolve(null);
            return;
        }

        console.log(`CPUコア数: ${cpuCount}, fx1: 1 Worker, fx2: ${fx2Workers} Workers`);

        // fx1専用のWorker
        const worker1 = new Worker("./Scripts/worker.js");
        workers.push(worker1);
        worker1.postMessage({ n, fxType: "fx1", workerId: 0, xStart: 2n });

        // fx2用のWorker
        for (let i = 1; i <= fx2Workers; i++) {
            try {
                const worker = new Worker("./Scripts/worker.js");
                workers.push(worker);

                const xStart = getRandomBigInt(n);
                worker.postMessage({ n, fxType: "fx2", workerId: i, xStart });

                worker.onmessage = function (event) {
                    if (event.data.factor) {
                        let factor = BigInt(event.data.factor);
                        console.log(`Worker ${i + 1} が因数 ${factor} を発見`);
                        workers.forEach((w) => w.terminate());
                        resolve(factor);
                    }

                    if (event.data.stopped) {
                        worker.terminate();
                        activeWorkers--;
                        if (activeWorkers === 0) {
                            console.log("すべての Worker が停止しました。");
                            resolve(null);
                        }
                    }
                };

                worker.onerror = function (error) {
                    console.error(`Worker ${i + 1} でエラー発生: ${error.message}`);
                    reject(error);
                };

            } catch (error) {
                console.error(`Worker ${i + 1} の作成に失敗: ${error.message}`);
                reject(error);
            }
        }
    });
}

function getRandomBigInt(n) {
    return BigInt(Math.floor(Math.random() * Number(n / 2n))) + 1n;
}
