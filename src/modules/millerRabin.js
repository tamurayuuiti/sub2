// ミラー・ラビン素数判定法
export function isPrimeMillerRabin(n) {
    console.log(`素数判定開始: n = ${n}`);

    let d = n - 1n, r = 0n;
    while (d % 2n === 0n) {
        d /= 2n;
        r++;
    }

    const witnesses = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];

    for (let a of witnesses) {
        if (a >= n) continue;
        let x = powerMod(a, d, n);
        if (x === 1n || x === n - 1n) continue;

        let isComposite = true;
        for (let i = 0n; i < r - 1n; i++) {
            x = (x * x) % n;
            if (x === n - 1n) {
                isComposite = false;
                break;
            }
        }
        if (isComposite) {
            console.log(`nは合成数: n = ${n} (証人 a = ${a})`);
            return false;
        }
    }

    console.log(`nは素数: n = ${n}`);
    return true;
}

export function powerMod(base, exp, mod) {
        let result = 1n;
        base %= mod;
        while (exp > 0n) {
            if (exp & 1n) result = (result * base) % mod;
            exp >>= 1n;
            base = (base * base) % mod;
        }
        return result;
    }
