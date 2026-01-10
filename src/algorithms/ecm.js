// ecm.js - ECM 法による因数分解アルゴリズム

import { isPrimeMillerRabin } from "./miller-rabin.js"; // ミラーラビン素数判定法

// ECM用の戦略リスト取得
function getStrategies() {
    return [
        { B1: 2000, B2: 200000, curvesPerWorker: 50 },
        { B1: 11000, B2: 1100000, curvesPerWorker: 30 },
        { B1: 50000, B2: 5000000, curvesPerWorker: 20 },
        { B1: 250000, B2: 25000000, curvesPerWorker: 10 },
        { B1: 1000000, B2: 100000000, curvesPerWorker: 5 } 
    ];
}

// ECM を再帰的に回して素因数を求める
export async function ecmFactorization(number, workerCount = 1) {
    if (typeof number !== "bigint") {
        throw new TypeError(`エラー: ecmFactorization() に渡された number (${number}) が BigInt ではありません。`);
    }

    if (number <= 1n) return [number];

    let factors = [];
    let composite = number;

    while (composite > 1n) {
        if (isPrimeMillerRabin(composite)) {
            console.log(`素因数を発見: ${composite}`);
            factors.push(composite);
            break;
        }

        let factor = null;

        while (!factor || factor === composite) {
            console.log(`ECM を試行: ${composite}`);
            factor = await ecmOneNumber(composite, { workerCount });

            if (factor === null) {
                console.error(`ECM ではこれ以上因数を発見できませんでした。残りは素数か巨大な合成数です: ${composite}`);
                factors.push(composite); 
                return factors;
            }
        }

        console.log(`因数を発見: ${factor}`);

        if (isPrimeMillerRabin(factor)) {
            factors.push(factor);
        } else {
            console.log(`合成数を発見: ${factor} → さらに再帰分解`);
            let subFactors = await ecmFactorization(factor, workerCount);
            factors = factors.concat(subFactors);
        }

        composite /= factor;
    }
    
    return factors.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

// ECM 本体
export async function ecmOneNumber(n, options = {}) {
  return new Promise((resolve, reject) => {
    const workers = [];
    const workerCount = (typeof options.workerCount === "number" && options.workerCount > 0)
      ? options.workerCount
      : 2;

    let activeWorkers = 0;
    let finished = false;
    
    const strategies = getStrategies();

    // 全ワーカー終了
    function terminateAllWorkers() {
      for (const w of workers) {
        try { w.terminate(); } catch (e) {}
      }
    }

    // 終了処理
    function finish(value, isReject = false) {
      if (finished) return;
      finished = true;
      terminateAllWorkers();
      if (isReject) reject(value);
      else resolve(value);
    }

    // ワーカー終了処理
    function handleWorkerExit(workerIndex) {
        if (finished) return;

        try { workers[workerIndex].terminate(); } catch(e) {}
        activeWorkers--;

        if (activeWorkers <= 0) {
            finish(null, false);
        }
    }

    // ワーカー初期化
    function postInitToWorker(worker, workerId, strategyIndex = 0) {
      if (finished) return;

      if (strategyIndex >= strategies.length) {
          handleWorkerExit(workerId);
          return;
      }

      const strat = strategies[strategyIndex];
      const randomSeed = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
      const sigma = randomSeed + BigInt(workerId);

      worker.currentStrategyIndex = strategyIndex;

      worker.postMessage({
        workerId: workerId,
        n: n.toString(),
        B1: strat.B1,
        B2: strat.B2,
        curves: strat.curvesPerWorker,
        sigmaStart: sigma.toString()
      });
    }

    for (let i = 0; i < workerCount; i++) {
      let worker;
      try {
        worker = new Worker("./src/workers/ecm.worker.js");
        workers.push(worker);
        activeWorkers++;
      } catch (err) {
        console.error(`worker ${i + 1} の起動に失敗しました:`, err);
        continue;
      }

      worker.onerror = function (err) {
        console.error(`worker ${i + 1} でエラーが発生しました:`, err.message || err);
        handleWorkerExit(i);
      };

      worker.onmessage = function (event) {
        if (!event || !event.data) return;
        const data = event.data;

        if (data.log) {
          console.log(String(data.log));
          return;
        }

        if (data.error) {
          console.error(`worker ${i + 1} からエラー報告がありました: ${data.error}`);
          const nextStrat = (worker.currentStrategyIndex || 0) + 1;
          postInitToWorker(worker, i, nextStrat);
          return;
        }

        if (data.factor) {
          try {
            const factorCandidate = BigInt(data.factor);
            if (factorCandidate > 1n && factorCandidate < n && n % factorCandidate === 0n) {
              finish(factorCandidate, false);
            } else {
              const nextStrat = (worker.currentStrategyIndex || 0) + 1;
              postInitToWorker(worker, i, nextStrat);
            }
          } catch (e) {
            console.error(`worker ${i + 1} の因数解析に失敗しました: ${e}`);
            const nextStrat = (worker.currentStrategyIndex || 0) + 1;
            postInitToWorker(worker, i, nextStrat);
          }
          return;
        }

        if (data.done) {
          const nextStrat = (worker.currentStrategyIndex || 0) + 1;
          postInitToWorker(worker, i, nextStrat);
          return;
        }
      };

      try {
        postInitToWorker(worker, i, 0);
      } catch (err) {
        console.error(`worker ${i + 1} への初期化メッセージ送信に失敗しました:`, err);
        handleWorkerExit(i);
      }
    }

    if (activeWorkers === 0) {
        resolve(null);
    }
  });
}
