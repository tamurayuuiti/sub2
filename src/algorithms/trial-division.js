// キャッシュ保持
let primesCache = null;

// 外部の素数リスト読み込み
export async function loadPrimes(progressCallback = null) {
    if (primesCache) {
        if (typeof progressCallback === "function") {
            progressCallback({ status: "cached", count: primesCache.length });
        }
        return primesCache;
    }

    try {
        if (typeof progressCallback === "function") progressCallback({ status: "start" });
        const response = await fetch("./src/data/primes.txt");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const text = await response.text();
        const tokens = text.split(/\s+/).filter(t => t.length > 0);
        if (tokens.length === 0) throw new Error("素数リストが空です");

        // BigInt に変換
        const out = new Array(tokens.length);
        const REPORT_INTERVAL = 10000;
        for (let i = 0; i < tokens.length; i++) {
            try {
                out[i] = BigInt(tokens[i]);
            } catch {
                out[i] = null;
                console.warn(`トークン変換失敗: index=${i} token=${tokens[i]}`);
            }
            if (typeof progressCallback === "function" && (i % REPORT_INTERVAL === 0)) {
                progressCallback({ status: "loading", i, total: tokens.length });
            }
        }
        primesCache = out.filter(x => x !== null);
        if (typeof progressCallback === "function") {
            progressCallback({ status: "done", count: primesCache.length });
        }
        return primesCache;
    } catch (err) {
        console.error("loadPrimes error:", err);
        if (typeof progressCallback === "function") {
            progressCallback({ status: "error", message: String(err) });
        }
        return [];
    }
}

// 試し割り法
export function trialDivision(number, primes, options = {}) {
    if (typeof number !== "bigint") throw new TypeError("number must be BigInt");
    if (!Array.isArray(primes) || primes.length === 0) {
        throw new Error("primes must be a non-empty BigInt[]");
    }

    const factors = [];
    const total = primes.length;
    const REPORT_INTERVAL = 10000;
    const maxPrime =
        (options.maxPrime !== undefined && options.maxPrime !== null)
            ? options.maxPrime
            : null;
    const progressCallback = options.progressCallback || null;

    for (let idx = 0; idx < total; idx++) {
        const prime = primes[idx];
        if (prime == null) continue;
        if (maxPrime !== null && prime > maxPrime) break;
        if (prime * prime > number) break;

        while (number % prime === 0n) {
            factors.push(prime);
            number /= prime;
        }

        if (typeof progressCallback === "function" && (idx % REPORT_INTERVAL === 0)) {
            progressCallback({ status: "progress", idx, total, remainder: number });
        }

        if (number === 1n) break;
    }

    return { factors, remainder: number };
}
