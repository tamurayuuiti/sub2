// ミラー・ラビン素数判定法
export function isPrimeMillerRabin(n) {
    console.log(`素数判定開始: n = ${n}`);
    if (n < 2n || (n > 2n && n % 2n === 0n)) return false;
    if (n === 2n || n === 3n) return true;

    let d = n - 1n, r = 0n;
    while (d % 2n === 0n) {
        d /= 2n;
        r++;
    }

    const witnesses = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];

    for (let a of witnesses) {
        if (a >= n) break;
        let x = powerMod(a, d, n);
        if (x === 1n || x === n - 1n) continue;

        for (let i = 0n; i < r - 1n; i++) {
            x = (x * x) % n;
            if (x === n - 1n) {
                return true;
            }
        }
        console.log(`nは合成数: n = ${n} (証人 a = ${a})`);
        return false;
    }

    console.log(`nは素数: n = ${n}`);
    return true;
}

export function powerMod(base, exp, mod) {
    let result = 1n;
    while (exp) {
        if (exp % 2n === 1n) result = (result * base) % mod;
        base = (base * base) % mod;
        exp /= 2n;
    }
    return result;
}
