// ミラーラビン素数判定法
import { isPrimeMillerRabin } from "./millerRabin.js";

/* ===========================
   ヘルパー関数
   =========================== */

// ランダムな odd c を main 側で生成
function randomOddC(range = 65536) {
  return (BigInt(Math.floor(Math.random() * range)) | 1n);
}

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

// 安全な initialX 取得
function getRandomX(n) {
  if (n <= 3n) return 2n;
  const range = n - 2n;
  const r = randomBigIntBelow(range);
  return r + 2n;
}

// CPU コア数に基づいてワーカー数を決定
function getWorkerCount() {
  const cpuCores = navigator.hardwareConcurrency || 4;
  if (cpuCores <= 8) return Math.max(1, cpuCores - 2);
  return Math.max(1, Math.floor(cpuCores * 0.6));
}

/* ===========================
   ブロックスケール決定
   =========================== */

function chooseBlockScaleByBits(n) {
  const bits = n.toString(2).length;
  if (bits < 80) return 32;
  if (bits < 160) return 64;
  if (bits < 320) return 128;
  if (bits < 640) return 256;
  return 512;
}

function clampPartBlock(pb, min = 32, max = 1024) {
  return Math.min(max, Math.max(min, pb));
}

/* ===========================
   エントリ（公開 API）
   =========================== */

// Pollard's Rho を再帰的に回して素因数を求める
export async function pollardsRhoFactorization(number) {
  if (typeof number !== "bigint") {
    throw new TypeError(`pollardsRhoFactorization: number must be BigInt.`);
  }

  const factors = [];
  let n = number;

  while (n > 1n) {
    if (isPrimeMillerRabin(n)) {
      factors.push(n);
      break;
    }

    let factor = null;

    while (!factor || factor === n) {
      factor = await pollardsRho(n);
      if (factor === null) return ["FAIL"];
    }

    if (isPrimeMillerRabin(factor)) {
      factors.push(factor);
    } else {
      const sub = await pollardsRhoFactorization(factor);
      if (sub.includes("FAIL")) return ["FAIL"];
      factors.push(...sub);
    }

    // 同じ因子をすべて取り除く
    while (n % factor === 0n) n /= factor;
  }

  return factors;
}

// Pollard's Rho 本体
export async function pollardsRho(n, options = {}) {
  return new Promise((resolve, reject) => {
    const workers = [];
    const workerCount = getWorkerCount();
    let activeWorkers = workerCount;
    let finished = false;

    if (workerCount <= 0) {
      resolve(null);
      return;
    }

    // オプション処理と安全デフォルト
    const thresholdBits = (typeof options.gcdThresholdBits === "number") ? options.gcdThresholdBits : 128;
    const nBits = n.toString(2).length;
    const useBinaryGcd = (nBits >= thresholdBits);

    // 統合スケールから m (BigInt) と PART_BLOCK (Number) を導出
    const scale = chooseBlockScaleByBits(n);
    const m = BigInt(scale);
    const PART_BLOCK = clampPartBlock(scale, 32, 1024);

    const MAX_TRIALS = (typeof options.MAX_TRIALS === "number" && Number.isFinite(options.MAX_TRIALS) && options.MAX_TRIALS > 0)
      ? Math.floor(options.MAX_TRIALS)
      : 100000000;

    const LOG_INTERVAL = (typeof options.logInterval === "number" && Number.isFinite(options.logInterval) && options.logInterval > 0)
      ? Math.floor(options.logInterval)
      : 2500000;

    const maxRestartsPerWorker = (typeof options.maxRestartsPerWorker === "number")
      ? Math.max(0, Math.floor(options.maxRestartsPerWorker))
      : 10;

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

    function postInitToWorker(worker, workerId, initialX, c) {
      worker.postMessage({
        n,
        workerId,
        initialX,
        c,
        useBinaryGcd,
        m,
        PART_BLOCK,
        MAX_TRIALS,
        logInterval: LOG_INTERVAL
      });
    }

    for (let i = 0; i < workerCount; i++) {
      let worker;
      try {
        worker = new Worker("./src/modules/worker.js");
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

      let restartCount = 0;
      let initialX = (i === 0) ? 2n : getRandomX(n);
      let c = randomOddC();

      try {
        postInitToWorker(worker, i, initialX, c);
      } catch (err) {
        console.error(`postInit failed for worker ${i + 1}:`, err);
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
          console.error(`worker ${i + 1} error: ${data.error}`);
          return;
        }

        if (data.factor) {
          try {
            const factorCandidate = BigInt(data.factor);
            // 必要最小限のチェック：1 < factor < n かつ n % factor === 0
            if (factorCandidate > 1n && factorCandidate < n && n % factorCandidate === 0n) {
              finish(factorCandidate, false);
            } else {
              console.warn(`worker ${i + 1} returned invalid factor: ${factorCandidate}`);
            }
          } catch (e) {
            console.error(`worker ${i + 1} factor parse error: ${e}`);
          }
          return;
        }

        if (data.stopped) {
          restartCount++;
          if (restartCount > maxRestartsPerWorker) {
            try { worker.terminate(); } catch (e) {}
            activeWorkers--;
            if (!finished && activeWorkers === 0) finish(null, false);
            return;
          }

          initialX = (i === 0) ? 2n : getRandomX(n);
          c = randomOddC();

          try {
            postInitToWorker(worker, i, initialX, c);
          } catch (err) {
            console.error(`failed to restart worker ${i + 1}:`, err);
            try { worker.terminate(); } catch (e) {}
            activeWorkers--;
            if (!finished && activeWorkers === 0) finish(null, false);
          }

          return;
        }
      };

      worker.onerror = function (err) {
        console.error(`worker ${i + 1} onerror:`, err.message || err);
        try { worker.terminate(); } catch (e) {}
        if (!finished) finish(err, true);
      };
    }
  });
}
