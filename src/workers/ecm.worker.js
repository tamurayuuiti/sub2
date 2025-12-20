// 定数
const ZERO = 0n;
const ONE = 1n;
const TWO = 2n;
const FOUR = 4n;

// グローバル変数
let globalTotalTrials = 0;
let currentNStr = null;

// ユークリッドの互除法によるGCD計算
function gcd(a, b) {
  a = a < ZERO ? -a : a;
  b = b < ZERO ? -b : b;
  while (b !== ZERO) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

// 拡張ユークリッドの互除法
function extendedGCD(a, m) {
    let t = ZERO, newt = ONE;
    let r = m, newr = a;
    while (newr !== ZERO) {
        let q = r / newr;
        let tmp = t - q * newt; t = newt; newt = tmp;
        tmp = r - q * newr; r = newr; newr = tmp;
    }
    if (t < ZERO) t += m;
    return { gcd: r, inv: t };
}

// 素数ふるい
const PrimeManager = {
    smallPrimes: [],
    sieveBuffer: null,
    maxSieved: 0,

    // 指定までの小素数リストを取得
    getSmallPrimes: function(max) {
        if (this.smallPrimes.length > 0 && this.smallPrimes[this.smallPrimes.length-1] >= max) {
            let idx = this.smallPrimes.findIndex(p => p > max);
            return idx === -1 ? this.smallPrimes : this.smallPrimes.slice(0, idx);
        }
        const bitset = new Uint8Array(max + 1);
        bitset.fill(1); bitset[0]=0; bitset[1]=0;
        const sqrt = Math.floor(Math.sqrt(max));
        for (let i = 2; i <= sqrt; i++) {
            if (bitset[i]) {
                for (let j = i*i; j <= max; j+=i) bitset[j] = 0;
            }
        }
        const newPrimes = [];
        for(let i=2; i<=max; i++) if(bitset[i]) newPrimes.push(i);
        this.smallPrimes = newPrimes;
        return this.smallPrimes;
    },

    // エラトステネスのふるいを拡張
    ensureSieve: function(max) {
        if (max <= this.maxSieved) return;

        const size = (max >> 3) + 1;
        const buffer = new Uint8Array(size);
        buffer.fill(0xFF);
        buffer[0] &= ~(1 << 0);
        buffer[0] &= ~(1 << 1);

        const sqrt = Math.floor(Math.sqrt(max));
        for (let i = 2; i <= sqrt; i++) {
            if ((buffer[i >> 3] & (1 << (i & 7))) !== 0) {
                for (let j = i * i; j <= max; j += i) {
                    buffer[j >> 3] &= ~(1 << (j & 7));
                }
            }
        }
        this.sieveBuffer = buffer;
        this.maxSieved = max;
    },

    *iteratePrimes(start, end) {
        if (end > this.maxSieved) this.ensureSieve(end);
        
        for (let i = start; i <= end; i++) {
            if ((this.sieveBuffer[i >> 3] & (1 << (i & 7))) !== 0) {
                yield i;
            }
        }
    }
};

// モンゴメリ曲線上の点倍算
function montgomeryLadder(k, x0, z0, A24, n) {
    k = BigInt(k); x0 = BigInt(x0); z0 = BigInt(z0); A24 = BigInt(A24); n = BigInt(n);
    let x1 = ONE, z1 = ZERO;
    let x2 = x0, z2 = z0;
    
    let msbMask = ONE;
    let tempK = k;
    while (tempK > ONE) { tempK >>= ONE; msbMask <<= ONE; }
    
    while (msbMask > ZERO) {
        const bit = (k & msbMask) > ZERO;
        let A = x1 + z1; if(A >= n) A -= n;
        let B = x1 - z1; if(B < ZERO) B += n;
        let C = x2 + z2; if(C >= n) C -= n;
        let D = x2 - z2; if(D < ZERO) D += n;
        let DA = (D * A) % n;
        let CB = (C * B) % n;
        let sum = DA + CB; if(sum >= n) sum -= n;
        let diff = DA - CB; if(diff < ZERO) diff += n;
        let x_add = (z0 * (sum * sum % n)) % n;
        let z_add = (x0 * (diff * diff % n)) % n;
        let t1, t2, t3, x_dbl, z_dbl;
        if (!bit) {
            t1 = (A * A) % n; t2 = (B * B) % n;
            t3 = t1 - t2; if(t3 < ZERO) t3 += n;
            x_dbl = (t1 * t2) % n;
            z_dbl = (t3 * (t2 + (A24 * t3) % n)) % n;
            x1 = x_dbl; z1 = z_dbl; x2 = x_add; z2 = z_add;
        } else {
            t1 = (C * C) % n; t2 = (D * D) % n;
            t3 = t1 - t2; if(t3 < ZERO) t3 += n;
            x_dbl = (t1 * t2) % n;
            z_dbl = (t3 * (t2 + (A24 * t3) % n)) % n;
            x1 = x_add; z1 = z_add; x2 = x_dbl; z2 = z_dbl;
        }
        msbMask >>= ONE;
    }
    return { x: x1, z: z1 };
}

// モンゴメリ差分加算
function montgomeryDiffAdd(Xm, Zm, Xp, Zp, Xd, Zd, n) {
    let A = Xm + Zm; if(A>=n) A-=n;
    let B = Xm - Zm; if(B<ZERO) B+=n;
    let C = Xd + Zd; if(C>=n) C-=n;
    let D = Xd - Zd; if(D<ZERO) D+=n;
    let DA = (D * A) % n;
    let CB = (C * B) % n;
    let sum = DA + CB; if(sum>=n) sum-=n;
    let diff = DA - CB; if(diff<ZERO) diff+=n;
    let X_new = (Zp * (sum * sum % n)) % n;
    let Z_new = (Xp * (diff * diff % n)) % n;
    return { x: X_new, z: Z_new };
}

// Suyamaパラメータ計算
function suyamaParam(sigma, n) {
    const sigma2 = (sigma * sigma) % n;
    let u = sigma2 - 5n; if(u<ZERO) u+=n;
    let v = (FOUR * sigma) % n;
    let u3 = (u * u % n) * u % n;
    let v3 = (v * v % n) * v % n;
    let v_minus_u = v - u; if(v_minus_u<ZERO) v_minus_u+=n;
    let term1 = (v_minus_u * v_minus_u % n) * v_minus_u % n;
    let term2 = (3n * u + v) % n;
    let num = (term1 * term2) % n;
    let den = (16n * u3 % n) * v % n;
    const { gcd: g, inv } = extendedGCD(den, n);
    if (g > ONE) return { factor: g };
    let A24 = (num * inv) % n;
    return { x: u3, z: v3, A24: A24 };
}

// ベビーステップの事前計算
function precomputeBabySteps(Qx, Qz, A24, n, D) {
    const babySteps = new Map();
    const limit = D / 2;
    let P1 = { x: Qx, z: Qz };
    if (gcd(1n, BigInt(D)) === ONE) babySteps.set(1, P1);
    let P2 = montgomeryLadder(2n, Qx, Qz, A24, n);
    if (gcd(2n, BigInt(D)) === ONE) babySteps.set(2, P2);
    let P_prev = P2;
    let P_prev2 = P1;
    for (let k = 3; k <= limit; k++) {
        let P_next = montgomeryDiffAdd(P_prev.x, P_prev.z, P_prev2.x, P_prev2.z, Qx, Qz, n);
        if (gcd(BigInt(k), BigInt(D)) === ONE) {
            babySteps.set(k, P_next);
        }
        P_prev2 = P_prev;
        P_prev = P_next;
    }
    return babySteps;
}

// ECMメイン関数
async function runCurves(n, B1, B2, curvesToRun, sigmaStart) {
    const primes = PrimeManager.getSmallPrimes(B1);
    
    if (B2 > B1) PrimeManager.ensureSieve(B2);

    const D = 2310;
    const D_bi = BigInt(D);
    const D_half = 1155; 

    for (let c = 0; c < curvesToRun; c++) {
        globalTotalTrials++;

        // 10回ごとにログ出力
        if (globalTotalTrials % 10 === 0) {
            const currentSigma = sigmaStart + BigInt(c);
            console.log(`累積試行 ${globalTotalTrials} (Sigma: ${currentSigma})`);

            await new Promise(r => setTimeout(r, 0));
        }

        let sigma = sigmaStart + BigInt(c);
        let params = suyamaParam(sigma, n);
        
        if (params && params.factor) {
             if (params.factor < n) return { factor: params.factor, trials: globalTotalTrials };
        }
        if (!params) continue;
        
        let { x: Qx, z: Qz, A24 } = params;

        // ステージ1
        for (let p of primes) {
            let pBi = BigInt(p);
            let q_pow = pBi;
            let B1_bi = BigInt(B1);
            while (q_pow * pBi <= B1_bi) q_pow *= pBi;
            let res = montgomeryLadder(q_pow, Qx, Qz, A24, n);
            Qx = res.x; Qz = res.z;
        }

        let g = gcd(Qz, n);
        if (g > ONE && g < n) return { factor: g, trials: globalTotalTrials };

        // ステージ2
        if (B2 > B1) {
            const babySteps = precomputeBabySteps(Qx, Qz, A24, n, D);
            let R = montgomeryLadder(D_bi, Qx, Qz, A24, n);
            let Rx = R.x, Rz = R.z;
            
            let primeIter = PrimeManager.iteratePrimes(B1 + 1, B2);
            let product = ONE;
            let currM = -1;
            let Tx = ONE, Tz = ZERO; 
            let Tpx = ONE, Tpz = ZERO; 
            let stepCount = 0;

            for (let q of primeIter) {
                let r = q % D;
                let m, j;
                if (r <= D_half) { m = (q - r) / D; j = r; } 
                else { m = (q - r) / D + 1; j = D - r; }

                if (currM === -1) {
                    currM = m;
                    let T_curr = montgomeryLadder(BigInt(m) * D_bi, Qx, Qz, A24, n);
                    let T_prev = montgomeryLadder(BigInt(m - 1) * D_bi, Qx, Qz, A24, n);
                    Tx = T_curr.x; Tz = T_curr.z;
                    Tpx = T_prev.x; Tpz = T_prev.z;
                } else {
                    while (currM < m) {
                        let T_next = montgomeryDiffAdd(Tx, Tz, Tpx, Tpz, Rx, Rz, n);
                        Tpx = Tx; Tpz = Tz;
                        Tx = T_next.x; Tz = T_next.z;
                        currM++;
                    }
                }

                const Bj = babySteps.get(j);
                if (!Bj) continue;

                let term = (Tx * Bj.z) - (Bj.x * Tz);
                term = term % n;
                if (term < 0n) term += n;
                if (term === ZERO) continue;

                product = (product * term) % n;
                stepCount++;

                if (stepCount % 200 === 0) {
                      let g2 = gcd(product, n);
                      if (g2 > ONE && g2 < n) return { factor: g2, trials: globalTotalTrials };
                      product = ONE;
                }
            }
            let g2 = gcd(product, n);
            if (g2 > ONE && g2 < n) return { factor: g2, trials: globalTotalTrials };
        }
    }
    return null;
}

// メッセージハンドラ
self.onmessage = async function(e) {
    const { n, B1, B2, curves, sigmaStart } = e.data;
    
    // グローバル変数初期化
    if (currentNStr !== n) {
        currentNStr = n;
        globalTotalTrials = 0;
    }

    const nBi = BigInt(n);
    const sigmaBi = BigInt(sigmaStart);

    try {
        const result = await runCurves(nBi, B1, B2, curves, sigmaBi);
        if (result && result.factor) {
            self.postMessage({ 
                factor: result.factor.toString(),
                trials: result.trials 
            });
        } else {
            self.postMessage({ done: true, trials: globalTotalTrials });
        }
    } catch (err) {
        self.postMessage({ error: err.message });
    }
};
