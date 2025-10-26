// 外部の素数リスト読み込み
export async function loadPrimes() {
    let primes = [];
    try {
        console.log("素数リストの読み込みを開始します");
        const response = await fetch("../src/primes_data/primes.txt");
        if (!response.ok) {
            throw new Error(`素数リストの読み込みに失敗しました (HTTP ${response.status})`);
        }
        const text = await response.text();
        primes = text.split(/\s+/).filter(n => n).map(n => BigInt(n));
        if (primes.length === 0) {
            throw new Error("素数リストが空です");
        }
        console.log(`素数リストの読み込みが完了しました。${primes.length} 個の素数を取得しました。`);
    } catch (error) {
        console.error("素数リストの取得エラー:", error);
        alert("素数リストの読み込みに失敗しました。ページを更新して再試行してください。");
    }
    return primes;
}

// 試し割り法
export async function trialDivision(number, primes, progressCallback = null) {
    let factors = [];

    const MAX_PRIME = number >= 10n ** 10n ? 100000n : 499979n;

    try {
        for (let i = 0; i < primes.length; i++) {
            if (primes[i] === undefined) break;
            let prime = BigInt(primes[i]);
            if (prime > MAX_PRIME) break;
            if (prime * prime > number) break;

            while (number % prime === 0n) {
                factors.push(prime);
                number /= prime;
            }
        }

    } catch (error) {
        console.error("試し割りエラー:", error);
        // 直接 DOM を操作せず、渡されたコールバックでメッセージを通知する
        if (typeof progressCallback === "function") {
            progressCallback("試し割り中にエラーが発生しました");
        } else {
            // 呼ばれていない場合はロギングのみ
            console.error("試し割り中にエラーが発生しました（コールバック未指定）");
        }
    }
    return { factors, remainder: number };
}
