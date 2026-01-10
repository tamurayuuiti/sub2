// pollards-rho.js - Pollard's Rho 法による因数分解アルゴリズム

import { isPrimeMillerRabin } from "./miller-rabin.js"; // ミラーラビン素数判定法

// BigInt 用の簡易ランダム生成
function randomBigIntBelow(rangeBigInt) {
  if (rangeBigInt <= 0n) return 0n;
  const bits = rangeBigInt.toString(2).length;
  const chunks = Math.ceil(bits / 30);
  let r = 0n;
  for (let i = 0; i < chunks; i++) {
    const part = BigInt(Math.floor(Math.random() * (1 << 30)));
    r = (r << 30n) | part;
  }
  if (r >= rangeBigInt) r = r % rangeBigInt;
  return r;
}

// ランダムな x を生成
function getRandomX(n) {
  if (n <= 3n) return 2n;
  const range = n - 2n;
  const r = randomBigIntBelow(range);
  return r + 2n;
}

// ランダムな c を生成
function randomC(range = 1_000_000) {
  let c = BigInt(Math.floor(Math.random() * range));
  if (c === 0n) c = 1n;
  return c;
}

// 再帰的に Pollard's Rho を回して素因数を求める
export async function pollardsRhoFactorization(number, workerCount = 1) {
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
            factor = await pollardsRho(number, { workerCount });

            if (factor === null) {
                console.error(`Pollard's Rho では因数を発見できませんでした。`);
                return ["FAIL"];
            }
        }

        console.log(`因数を発見: ${factor}`);

        if (isPrimeMillerRabin(factor)) {
            factors.push(factor);
        } else {
            console.log(`合成数を発見: ${factor} → さらに分解`);
            let subFactors = await pollardsRhoFactorization(factor, workerCount);
            if (subFactors.includes("FAIL")) return ["FAIL"];
            factors = factors.concat(subFactors);
        }

        number /= factor;
    }
    return factors;
}

// Pollard's Rho 本体
export async function pollardsRho(n, options = {}) {
  return new Promise((resolve, reject) => {
    const workers = [];
    const workerCount = (typeof options.workerCount === "number" && options.workerCount > 0)
      ? options.workerCount
      : 2;

    let activeWorkers = workerCount;
    let finished = false;

    if (workerCount <= 0) {
      resolve(null);
      return;
    }

    const PART_BLOCK = 32;
    const m = 32n;

    // 最大試行回数
    const MAX_TRIALS = (typeof options.MAX_TRIALS === "number" && Number.isFinite(options.MAX_TRIALS) && options.MAX_TRIALS > 0)
      ? Math.floor(options.MAX_TRIALS)
      : 100_000_000;
  
    // ログ出力間隔
    const LOG_INTERVAL = (typeof options.logInterval === "number" && Number.isFinite(options.logInterval) && options.logInterval > 0)
      ? Math.floor(options.logInterval)
      : 1_000_000;

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

    // ワーカー初期化メッセージ送信
    function postInitToWorker(worker, workerId, initialX, c) {
      worker.postMessage({
        n,
        c,
        m,
        workerId,
        initialX,
        PART_BLOCK,
        MAX_TRIALS,
        logInterval: LOG_INTERVAL
      });
    }

    for (let i = 0; i < workerCount; i++) {
      let worker;
      try {
        worker = new Worker("./src/workers/pollards-rho.worker.js");
        workers.push(worker);
      } catch (err) {
        console.error(`worker ${i + 1} の起動に失敗しました:`, err);
        activeWorkers--;
        if (activeWorkers <= 0) {
          finish(null, false);
          return;
        }
        continue;
      }

      let initialX = (i === 0) ? 2n : getRandomX(n);
      let c = randomC();

      try {
        postInitToWorker(worker, i, initialX, c);
      } catch (err) {
        console.error(`worker ${i + 1} への初期化メッセージ送信に失敗しました:`, err);
        try { worker.terminate(); } catch (e) {}
        activeWorkers--;
        if (!finished && activeWorkers === 0) finish(null, false);
        continue;
      }

      worker.onmessage = function (event) {
        if (!event || !event.data) return;
        const data = event.data;

        if (data.log) {
          console.log(String(data.log));
          return;
        }

        if (data.error) {
          console.error(`worker ${i + 1} からエラー報告がありました: ${data.error}`);
          return;
        }

        if (data.factor) {
          try {
            const factorCandidate = BigInt(data.factor);
            if (factorCandidate > 1n && factorCandidate < n && n % factorCandidate === 0n) {
              finish(factorCandidate, false);
            } else {
              console.warn(`worker ${i + 1} が無効な因数を返しました: ${factorCandidate}`);
            }
          } catch (e) {
            console.error(`worker ${i + 1} の因数解析に失敗しました: ${e}`);
          }
          return;
        }

        if (data.stopped) {
          try { worker.terminate(); } catch (e) {}
          activeWorkers--;

          if (!finished && activeWorkers === 0) {
            finish(null, false); 
          }
          return;
        }
      };

      worker.onerror = function (err) {
        console.error(`worker ${i + 1} でエラーが発生しました:`, err.message || err);
        try { worker.terminate(); } catch (e) {}
        if (!finished) finish(err, true);
      };
    }
  });
}
