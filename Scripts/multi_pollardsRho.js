// どの f(x) を使用するか制御するオブジェクト
const ENABLE_FX = {
    fx1: false,  
    fx2: true,   
    fx2Count: getOptimalFx2Count()
};

export async function pollardsRho(n) {
    return new Promise((resolve, reject) => {
        const workers = [];
        let fxTypes = Object.keys(ENABLE_FX).filter(fx => ENABLE_FX[fx] === true);

        if (ENABLE_FX.fx2) {
            for (let i = 1; i < ENABLE_FX.fx2Count; i++) {
                fxTypes.push("fx2");
            }
        }

        let activeWorkers = fxTypes.length;
        if (activeWorkers === 0) {
            console.error(`全ての f(x) が無効です。少なくとも 1 つ有効にしてください。`);
            resolve(null);
            return;
        }

        for (let i = 0; i < fxTypes.length; i++) {
            try {
                const worker = new Worker("./Scripts/worker.js");
                workers.push(worker);

                let initialX = assignX(i, n, ENABLE_FX.fx2Count);

                worker.postMessage({ n, fxType: fxTypes[i], workerId: i, initialX });

                worker.onmessage = function (event) {
                    console.log(`受信データ:`, event.data);

                    if (event.data.error) {
                        console.error(`worker ${i + 1} でエラー発生: ${event.data.error}`);
                        return;
                    }

                    if (event.data.factor) {
                        try {
                            let factor = BigInt(event.data.factor);
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

// CPU コア数に基づいて fx2Count を決定
export function getOptimalFx2Count() {
    const cpuCores = navigator.hardwareConcurrency || 4;

    if (cpuCores <= 8) {
        return Math.max(1, cpuCores - 2);
    } else {
        return Math.max(1, Math.floor(cpuCores * 0.6));
    }
}

function assignX(workerId, n, fx2Count) {
    if (workerId === 0) return 2n;
    if (workerId === 1) return n / 2n;
    return getRandomX(n);
}

function getRandomX(n) {
    return BigInt(Math.floor(Math.random() * Number(n - 2n))) + 2n;
}
