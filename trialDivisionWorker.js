self.onmessage = function(event) {
    let { number, primes } = event.data;  // メインスレッドから送られたデータを取得
    let factors = [];
    number = BigInt(number);

    for (let i = 0; i < primes.length; i++) {
        let prime = BigInt(primes[i]);
        if (prime * prime > number) break;  // √n までの試し割り
        while (number % prime === 0n) {
            factors.push(prime);
            number /= prime;
        }
    }

    // 試し割りの結果をメインスレッドに送信
    self.postMessage({ factors, remainder: number });
};
