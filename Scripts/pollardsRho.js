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
        const numCores = navigator.hardwareConcurrency || 4; 
        const numWorkers = numCores;
        const xEnd = 10n ** 10n;
        const xMid = xEnd / 2n;

        const xRanges = [];

        xRanges.push({ fxType: "fx1" });
        xRanges.push({ fxType: "fx2", xMin: 0n, xMax: xMid });

        const remainingWorkers = numWorkers - 2;
        const stepSize = (xEnd - xMid) / BigInt(remainingWorkers);

        for (let i = 0; i < remainingWorkers; i++) {
            let xMin = xMid + stepSize * BigInt(i);
            let xMax = xMin + stepSize;
            xRanges.push({ fxType: "fx2", xMin, xMax });
        }

        const workers = [];
        const commonC = getRandomC(n, getDigitBasedParams(n).maxC);
        let activeWorkers = numWorkers; // 🔹 修正: worker のカウントを管理

        for (let i = 0; i < numWorkers; i++) {
            const workerId = i; // 🔹 修正: `i` の値を固定
            const worker = new Worker("./Scripts/worker.js");
            workers.push(worker);

            worker.postMessage({ 
                n, 
                fxType: xRanges[workerId].fxType, 
                xRange: xRanges[workerId].xMin !== undefined ? { xMin: xRanges[workerId].xMin, xMax: xRanges[workerId].xMax } : undefined, 
                c: commonC, 
                workerId 
            });

            worker.onmessage = function (event) {
                console.log(`worker ${workerId + 1} 受信データ:`, event.data);

                if (event.data.error) {
                    console.error(`worker ${workerId + 1} でエラー発生: ${event.data.error}`);
                    return;
                }

                if (event.data.factor) {
                    try {
                        let factor = BigInt(event.data.factor);
                        console.log(`worker ${workerId + 1} が因数 ${factor} を発見（試行回数: ${BigInt(event.data.trials)}）`);
                        workers.forEach((w) => w.terminate());
                        resolve(factor);
                    } catch (error) {
                        console.error(`BigInt 変換エラー: ${error.message}`);
                    }
                }

                if (event.data.stopped) {
                    console.log(`worker ${workerId + 1} が試行上限に達し停止`);
                    worker.terminate();
                    activeWorkers--;

                    if (activeWorkers === 0) {
                        console.log(`すべての worker が停止しました。因数を発見できませんでした。`);
                        resolve(null);
                    }
                }
            };

            worker.onerror = function (error) {
                console.error(`worker ${workerId + 1} でエラー発生: ${error.message}`);
                activeWorkers--;
                if (activeWorkers === 0) {
                    reject(error);
                }
            };
        }
    });
}

export function getDigitBasedParams(n) {
    try {
        let digitCount = n.toString().length;
        return { maxC: digitCount <= 20 ? 30 : 50 };
    } catch (error) {
        console.error("getDigitBasedParams() でエラー:", error.message);
        return { maxC: 50 };
    }
}

export function getRandomC(n, maxC) {
    try {
        const buffer = new Uint32Array(1);
        crypto.getRandomValues(buffer);
        return BigInt((buffer[0] % maxC) * 2 + 1);
    } catch (error) {
        console.error("getRandomC() でエラー:", error.message);
        return 1n;
    }
}
