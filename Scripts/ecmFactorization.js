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
                workers[i] = new Worker("ecmWorker.js");
                workers[i].postMessage(number.toString());  // ✅ BigInt を文字列化して送る

                // ✅ Web Worker のログをメインスレッドに転送
                workers[i].onmessage = event => {
                    if (event.data.type === "log") {
                        console.log(`[Worker ${i + 1}] ${event.data.message}`);
                    }
                };
            }

            const results = await Promise.all(workers.map(worker => 
                new Promise(resolve => {
                    worker.onmessage = event => {
                        if (event.data.type === "result") {
                            resolve(BigInt(event.data.factor)); // ✅ 受け取った値を BigInt に戻す
                            worker.terminate(); // ✅ メモリリーク防止
                        }
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
            console.log(`🔹 ${factor} は素数`);
            factors.push(factor);
        } else {
            console.log(`🔄 ${factor} は合成数 → さらに分解`);
            let subFactors = await ecmFactorization(factor);
            if (subFactors.includes("FAIL")) return ["FAIL"];
            factors = factors.concat(subFactors);
        }

        number /= factor;
    }

    console.log(`===== 因数分解完了: ${factors} =====`);
    return factors;
}
