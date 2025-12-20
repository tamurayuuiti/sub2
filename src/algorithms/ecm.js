// ミラーラビン素数判定法
import { isPrimeMillerRabin } from "./miller-rabin.js";

// ECM用の戦略リスト
function getStrategies() {
    return [
        { B1: 2000, B2: 200000, curvesPerWorker: 10 },
        { B1: 10000, B2: 1000000, curvesPerWorker: 20 },
        { B1: 50000, B2: 5000000, curvesPerWorker: 40 },
        { B1: 250000, B2: 25000000, curvesPerWorker: 50 },
        { B1: 1000000, B2: 100000000, curvesPerWorker: 50 } 
    ];
}

// ECM を再帰的に回して素因数を求める
export async function ecmFactorization(number, workerCount = 1) {
    if (typeof number !== "bigint") {
        throw new TypeError(`エラー: ecmFactorization() に渡された number (${number}) が BigInt ではありません。`);
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
            console.log(`ECM を試行: ${number}`);
            factor = await ecmOneNumber(number, { workerCount });

            if (factor === null) {
                console.error(`ECM では因数を発見できませんでした。`);
                return ["FAIL"];
            }
        }

        console.log(`因数を発見: ${factor}`);

        if (isPrimeMillerRabin(factor)) {
            factors.push(factor);
        } else {
            console.log(`合成数を発見: ${factor} → さらに分解`);
            let subFactors = await ecmFactorization(factor, workerCount);
            if (subFactors.includes("FAIL")) return ["FAIL"];
            factors = factors.concat(subFactors);
        }

        number /= factor;
    }
    return factors;
}

// ECM 本体
export async function ecmOneNumber(n, options = {}) {
  return new Promise((resolve, reject) => {
    const workers = [];
    // workerCount オプションを処理
    const workerCount = (typeof options.workerCount === "number" && options.workerCount > 0)
      ? options.workerCount
      : 2;

    let activeWorkers = workerCount;
    let finished = false;
    
    // ECM用の戦略取得
    const strategies = getStrategies();

    if (workerCount <= 0) {
      resolve(null);
      return;
    }

    function terminateAllWorkers() {
      for (const w of workers) {
        try { w.terminate(); } catch (e) {}
      }
    }

    function finish(value, isReject = false) {
      if (finished) return;
      finished = true;
      terminateAllWorkers();
      if (isReject) reject(value);
      else resolve(value);
    }

    function postInitToWorker(worker, workerId, strategyIndex = 0) {
      if (strategyIndex >= strategies.length) {
          try { worker.terminate(); } catch (e) {}
          activeWorkers--;
          if (!finished && activeWorkers === 0) finish(null, false);
          return;
      }

      const strat = strategies[strategyIndex];
      // 異なるSigmaを生成 (ECM固有)
      const base = BigInt(Math.floor(Math.random() * 1000000));
      const sigma = base + BigInt(workerId * 1000) + BigInt(strategyIndex * 100000);

      // 現在の戦略インデックスをWorkerに保存
      worker.currentStrategyIndex = strategyIndex;

      worker.postMessage({
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
      } catch (err) {
        console.error(`worker ${i + 1} creation failed:`, err);
        activeWorkers--;
        if (activeWorkers <= 0) {
          finish(null, false);
          return;
        }
        continue;
      }

      // ECMの最初の戦略を開始
      try {
        postInitToWorker(worker, i, 0);
      } catch (err) {
        console.error(`postInit failed for worker ${i + 1}:`, err);
        try { worker.terminate(); } catch (e) {}
        activeWorkers--;
        if (!finished && activeWorkers === 0) finish(null, false);
        continue;
      }

      // メッセージハンドラ
      worker.onmessage = function (event) {
        if (!event || !event.data) return;
        const data = event.data;

        if (data.log) {
          console.log(String(data.log));
          return;
        }

        if (data.error) {
          console.error(`worker ${i + 1} error: ${data.error}`);
          if (!finished) {
             const nextStrat = (worker.currentStrategyIndex || 0) + 1;
             postInitToWorker(worker, i, nextStrat);
          }
          return;
        }

        if (data.factor) {
          try {
            const factorCandidate = BigInt(data.factor);
            // 妥当な因数か検証
            if (factorCandidate > 1n && factorCandidate < n && n % factorCandidate === 0n) {
              finish(factorCandidate, false);
            } else {
              const nextStrat = (worker.currentStrategyIndex || 0) + 1;
              postInitToWorker(worker, i, nextStrat);
            }
          } catch (e) {
            console.error(`worker ${i + 1} factor parse error: ${e}`);
          }
          return;
        }

        // 戦略完了通知
        if (data.done) {
          const nextStrat = (worker.currentStrategyIndex || 0) + 1;
          
          try {
            postInitToWorker(worker, i, nextStrat);
          } catch (err) {
            console.error(`failed to restart worker ${i + 1}:`, err);
            try { worker.terminate(); } catch (e) {}
            activeWorkers--;
            if (!finished && activeWorkers === 0) finish(null, false);
          }

          return;
        }
      };

      // エラー処理
      worker.onerror = function (err) {
        console.error(`worker ${i + 1} onerror:`, err.message || err);
        try { worker.terminate(); } catch (e) {}
        if (!finished) finish(err, true);
      };
    }
  });
}
