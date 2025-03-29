// ミラー・ラビン素数判定法
import { isPrimeMillerRabin } from './millerRabin.js';

const ENABLE_FX = {
    fx1: true,  
    fx2: true   
};

const MAX_WORKERS = navigator.hardwareConcurrency || 4;
const workerQueue = [];
const workerPool = [];
const sharedBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
const sharedView = new Int32Array(sharedBuffer);

let fx1Worker = null;
let fx2Workers = [];

function checkAndSetFactor(factor) {
    if (Atomics.compareExchange(sharedView, 0, 0, Number(factor)) === 0) {
        return true;
    }
    return false;
}

function createWorker(n, fxType, workerId) {
    let worker;
    if (workerPool.length > 0) {
        worker = workerPool.pop(); 
    } else if (workerQueue.length < MAX_WORKERS) {
        worker = new Worker("./Scripts/worker.js");
        workerQueue.push(worker);
    } else {
        return null;
    }

    worker.postMessage({ n, fxType, workerId, sharedBuffer });
    return worker;
}

function setupFx1Worker(n) {
    fx1Worker = createWorker(n, "fx1", 0);
    if (fx1Worker) {
        fx1Worker.onmessage = function (event) {
            const { factor } = event.data;
            if (factor && checkAndSetFactor(factor)) {
                console.log("Found factor by fx1:", factor);
            }
            workerPool.push(fx1Worker);
            fx2Workers.push(fx1Worker);
            fx1Worker = null;
        };
    }
}

function setupFx2Workers(n) {
    for (let i = 1; i < MAX_WORKERS; i++) {
        let worker = createWorker(n, "fx2", i);
        if (worker) {
            fx2Workers.push(worker);
            worker.onmessage = function (event) {
                const { factor } = event.data;
                if (factor && checkAndSetFactor(factor)) {
                    console.log("Found factor by fx2:", factor);
                }
                workerPool.push(worker);
            };
        }
    }
}

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
        setupFx1Worker(n);
        setupFx2Workers(n);

        fx2Workers.forEach((worker, i) => {
            worker.onmessage = function (event) {
                if (event.data.factor) {
                    let factor = BigInt(event.data.factor);
                    console.log(`Worker ${i + 1} found factor: ${factor}`);
                    resolve(factor);
                    fx2Workers.forEach(w => w.terminate());
                }
                if (event.data.stopped) {
                    worker.terminate();
                    resolve(null);
                }
            };
        });
    });
}

