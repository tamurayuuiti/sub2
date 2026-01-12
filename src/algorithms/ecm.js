// ecm.js - ECM 法による因数分解アルゴリズム

import { isPrimeMillerRabin } from "./miller-rabin.js"; // ミラーラビン素数判定法

// ECM用の戦略リスト
function getStrategies() {
  return [
    { Level: 1, B1: 2_000,   B2: 200_000,   curvesPerWorker: 30 },
    { Level: 2, B1: 30_000,  B2: 3_000_000, curvesPerWorker: 3 },
    { Level: 3, B1: 100_000, B2: 10_000_000,curvesPerWorker: 1 },
  ];
}

// ECM を再帰的に回して素因数を求める
export async function ecmFactorization(number, workerCount = 1) {
    if (typeof number !== "bigint") {
        throw new TypeError(`ECM 法に渡された値: (${number}) が BigInt ではありません`);
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
                console.error(`ECM ではこれ以上因数を発見できませんでした。残りは巨大な合成数です: ${composite}`);
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

    let strategyStarted = false;
    let activeWorkers = 0;
    let finished = false;
    
    const strategies = getStrategies();
    const initialStrategyIndex = 0;

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
    function postInitToWorker(worker, workerId, nextStrategyIndex) {
      if (finished) return;

      if (nextStrategyIndex >= strategies.length) {
        handleWorkerExit(workerId);
        return;
      }

      const strat = strategies[nextStrategyIndex];

      if (!strategyStarted && nextStrategyIndex === 0) {
        console.log(
          `ECM 戦略 Lv1 を開始します`
        );
        strategyStarted = true;
      }

      if (worker.sigmaBase === undefined) {
        worker.sigmaBase =
          BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)) + BigInt(workerId);
      }

      const sigmaStart = worker.sigmaBase;

      worker.sigmaBase += BigInt(strat.curvesPerWorker);
      worker.currentStrategyIndex = nextStrategyIndex;

      worker.postMessage({
        workerId: workerId,
        n: n.toString(),
        B1: strat.B1,
        B2: strat.B2,
        curves: strat.curvesPerWorker,
        sigmaStart: sigmaStart.toString()
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
          postInitToWorker(worker, i, worker.currentStrategyIndex + 1);
          return;
        }

        if (data.factor) {
          try {
            const factorCandidate = BigInt(data.factor);
            if (factorCandidate > 1n && factorCandidate < n && n % factorCandidate === 0n) {
              finish(factorCandidate, false);
            } else {
              postInitToWorker(worker, i, worker.currentStrategyIndex + 1);
            }
          } catch (e) {
            console.error(`worker ${i + 1} の因数解析に失敗しました: ${e}`);
            postInitToWorker(worker, i, worker.currentStrategyIndex + 1);
          }
          return;
        }

        if (data.done) {
          const nextIndex = worker.currentStrategyIndex + 1;

          if (nextIndex < strategies.length) {
            console.log(
              `worker ${i + 1} が Lv${worker.currentStrategyIndex + 1} を完了しました。Lv${nextIndex + 1}を開始します`);
            postInitToWorker(worker, i, nextIndex);
          } else {
            console.log(
              `worker ${i + 1} が Lv${worker.currentStrategyIndex + 1} を完了しました`);
            handleWorkerExit(i);
          }
          return;
        }
      };

      try {
        postInitToWorker(worker, i, initialStrategyIndex);
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
