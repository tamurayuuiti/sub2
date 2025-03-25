// ミラー・ラビン素数判定法
import { isPrimeMillerRabin } from './millerRabin.js';

// ✅ どの `f(x)` を使用するか制御するオブジェクト
const ENABLE_FX = {
    fx1: true,  // (x² + 7x + c) % n
    fx2: true,  // (x² + c x) % n
    fx3: true   // (x³ + c) % n
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
        const fxTypes = Object.keys(ENABLE_FX).filter(fx => ENABLE_FX[fx]); 
        let activeWorkers = fxTypes.length;

        if (activeWorkers === 0) {
            console.error(`❌ 全ての f(x) が無効です。少なくとも 1 つ有効にしてください。`);
            resolve(null);
            return;
        }

        for (let i = 0; i < fxTypes.length; i++) {
            try {
                const worker = new Worker("./Scripts/Worker.js");
                workers.push(worker);
                console.log(`✅ Worker ${i + 1} (${fxTypes[i]}) を作成しました。`);

                worker.postMessage({ n, fxType: fxTypes[i] });

                worker.onmessage = function (event) {
                    console.log(`受信データ:`, event.data);

                    if (event.data.error) {
                        console.error(`❌ Worker ${i + 1} (${fxTypes[i]}) でエラー発生: ${event.data.error}`);
                        return;
                    }

                    if (event.data.factor) {
                        try {
                            let factor = BigInt(event.data.factor); 
                            console.log(`🎯 Worker ${i + 1} (${fxTypes[i]}) が因数 ${factor} を発見！（試行回数: ${BigInt(event.data.trials)}）`);
                            setTimeout(() => {
                                workers.forEach((w) => w.terminate());
                            }, 50); // 50ms 遅延
                            resolve(factor);
                        } catch (error) {
                            console.error(`BigInt 変換エラー: ${error.message}`);
                        }
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
                    reject(error);
                };

            } catch (error) {
                console.error(`🚨 Worker ${i + 1} の作成に失敗しました: ${error.message}`);
                reject(error);
            }
        }
    });
}
