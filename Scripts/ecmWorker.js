importScripts("ecmUtils.js , ecmFactorization.js");

self.onmessage = async function(event) {
    const number = BigInt(event.data);
    self.postMessage({ type: "log", message: `🔄 Worker: ECM 実行開始 (${number})` });

    try {
        const factor = await ecm(number, msg => self.postMessage({ type: "log", message: msg }));

        self.postMessage({ type: "log", message: `✅ Worker: ECM 終了 (${factor})` });
        self.postMessage({ type: "result", factor: factor ? factor.toString() : "null" });
    } catch (error) {
        self.postMessage({ type: "log", message: `❌ Worker: エラー発生 - ${error.message}` });
        self.postMessage({ type: "result", factor: "null" });
    }
};
