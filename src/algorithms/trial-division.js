// trial-division.js - 試し割り法による因数分解アルゴリズム

let primesCache = null;

// 外部の素数リスト読み込み
export async function loadPrimes(progressCallback = null) {
    if (primesCache) {
        progressCallback?.({ status: "cached", count: primesCache.length });
        return primesCache;
    }

    try {
        progressCallback?.({ status: "start" });

        const response = await fetch("./src/data/primes.txt");
        if (!response.ok) {
            throw new Error(`HTTPステータス ${response.status}`);
        }

        const text = await response.text();
        const tokens = text.split(/\s+/).filter(Boolean);

        if (tokens.length === 0) {
            throw new Error("素数リストが空です");
        }

        const result = [];
        const REPORT_INTERVAL = 10000;

        for (let i = 0; i < tokens.length; i++) {
            try {
                result.push(BigInt(tokens[i]));
            } catch {
                console.warn(`素数変換失敗: index=${i}, value=${tokens[i]}`);
            }

            if (i % REPORT_INTERVAL === 0) {
                progressCallback?.({ status: "loading", i, total: tokens.length });
            }
        }

        primesCache = result;
        progressCallback?.({ status: "done", count: primesCache.length });
        return primesCache;

    } catch (err) {
        console.error("素数リスト読み込み失敗:", err);
        progressCallback?.({ status: "error", message: String(err) });
        return [];
    }
}

// 試し割り法
export function trialDivision(number, primes, options = {}) {
    if (typeof number !== "bigint") {
        throw new TypeError(`試し割り法に渡された値: (${number}) が BigInt ではありません`);
    }

    if (!Array.isArray(primes) || primes.length === 0) {
        throw new Error("素数リストが空のため試し割りを実行できません");
    }

    const factors = [];
    const total = primes.length;
    const progressCallback = options.progressCallback ?? null;
    const maxPrime = options.maxPrime ?? null;
    const REPORT_INTERVAL = 10000;

    for (let i = 0; i < total; i++) {
        const p = primes[i];
        if (p == null) continue;
        if (maxPrime !== null && p > maxPrime) break;
        if (p * p > number) break;

        while (number % p === 0n) {
            factors.push(p);
            number /= p;
        }

        if (i % REPORT_INTERVAL === 0) {
            progressCallback?.({ status: "progress", i, total, remainder: number });
        }

        if (number === 1n) break;
    }

    return { factors, remainder: number };
}
