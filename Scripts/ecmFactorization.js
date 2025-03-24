// ミラー・ラビン素数判定法
import { isPrimeMillerRabin } from './millerRabin.js';

export async function ecmFactorization(number) {
    if (typeof number !== "bigint") {
        throw new TypeError(`エラー: ecmFactorization() に渡された number (${number}) が BigInt ではありません。`);
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

        let factor = null;
        const cpuCores = navigator.hardwareConcurrency || 4;
        console.log(`⚡ Web Worker 並列 ECM 試行数: ${cpuCores}`);

        while (!factor || factor === number) {
            console.log(`🔄 ECM を試行: ${number}`);

            const workers = [];
            for (let i = 0; i < cpuCores; i++) {
                try {
                    workers[i] = new Worker("./Scripts/ecmWorker.js", { type: "module" });
                    workers[i].onerror = (event) => {
                        console.error(`❌ Worker ${i + 1} でエラー発生:`, event.message);
                    };
                    workers[i].postMessage(number.toString());
                } catch (error) {
                    console.error(`❌ Worker ${i + 1} の作成に失敗: ${error.message}`);
                }
            }

            const results = await Promise.all(workers.map(worker => 
                new Promise(resolve => {
                    worker.onmessage = event => {
                        if (event.data.type === "result") {
                            if (event.data.factor === "null" || event.data.factor === null) {
                                console.error("❌ Worker から null を受信！");
                                resolve(null);  // `null` をそのまま返す
                            } else {
                                resolve(BigInt(event.data.factor));
                            }
                        }
                        worker.terminate();
                    };
                })
            ));

            factor = results.find(f => f && f !== number);

            if (!factor) {
                console.error(`❌ ECM では因数を発見できませんでした。`);
                return ["FAIL"];
            }
        }

        console.log(`✅ 見つかった因数: ${factor}`);

        if (isPrimeMillerRabin(factor)) {
            factors.push(factor);
        } else {
            let subFactors = await ecmFactorization(factor);
            if (subFactors.includes("FAIL")) return ["FAIL"];
            factors = factors.concat(subFactors);
        }

        number /= factor;
    }

    console.log(`===== 因数分解完了: ${factors} =====`);
    return factors;
}
