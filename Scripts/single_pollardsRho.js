export async function pollardsRho(n) {
    let { k, digitCount, MAX_TRIALS } = getDigitBasedParams(n);
    let { fxFunction, fxEquation } = getFxFunction(digitCount);
    let trialCount = 0n;
    let x = 2n, y = 2n, d = 1n;
    let m = 128n, q = 1n;
    let c = getRandomC(n);

    console.log(`計算開始: f(x) = ${fxEquation}, 試行上限 ${MAX_TRIALS} 回`);

    x = fxFunction(x, c, n);
    y = fxFunction(fxFunction(y, c, n), c, n);

    while (d === 1n && trialCount < BigInt(MAX_TRIALS)) {
        let ys = y;
        for (let i = 0n; i < m && trialCount < BigInt(MAX_TRIALS); i++) {
            y = fxFunction(fxFunction(y, c, n), c, n);
            q = abs(x - y) * q % n;
            trialCount++;

            if (q === 0n) {
                console.log(`エラー: q が 0 になりました。`);
                q = 1n;
            }

            if (i % (k + (m / 16n)) === 0n) {
                d = gcd(q, n);
                if (d > 1n) break;
            }

            if (trialCount % 1000000n === 0n) {
                console.log(`試行 ${trialCount}, fx = ${fxEquation}, x=${x}, y=${y}, c=${c}, q=${q}, gcd=${d}`);
                await new Promise(resolve => setTimeout(resolve, 0));
            }           
        }
        x = ys;
        if (d === 1n) {
            m = (m * 3n) >> 1n;
        }
    }

    return (d > 1n && d !== n) ? d : null;
}

export function getDigitBasedParams(n) {
    let digitCount = Math.floor(Math.log10(Number(n))) + 1;
    let k = digitCount <= 20 ? 10n : digitCount <= 30 ? 15n : 25n;
    let MAX_TRIALS = digitCount <= 15 ? 1000000 : 100000000;
    return { digitCount, k, MAX_TRIALS };
}

export function getFxFunction(digitCount) {
    if (digitCount <= 15) {
        return {
            fxFunction: (x, c, n) => (3n * x * x + 7n * x + c) % n,
            fxEquation: "(3x² + 7x + c) mod n"
        };
    } else {
        return {
            fxFunction: (x, c, n) => (x * x * x + 5n * x + c) % n,
            fxEquation: "(x³ + 5x + c) mod n"
        };
    }
}

export function getRandomC(n) {
    return BigInt((Math.random() * 50) | 0) * 2n + 1n;
}

export function gcd(a, b) {
    if (a === 0n) return b;
    if (b === 0n) return a;

    let shift = 0n;
    while (((a | b) & 1n) === 0n) {
        a >>= 1n;
        b >>= 1n;
        shift++;
    }

    while ((a & 1n) === 0n) a >>= 1n;
    while (b !== 0n) {
        while ((b & 1n) === 0n) b >>= 1n;
        if (a > b) [a, b] = [b, a];
        b -= a;
        if (b === 0n) break;
    }

    return a << shift;
}

export function abs(n) {
    return n < 0n ? -n : n;
}
