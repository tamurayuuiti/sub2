export async function trialDivision(number, primes) {
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
        document.getElementById("result").textContent = "試し割り中にエラーが発生しました";
    }
    return { factors, remainder: number };
}
