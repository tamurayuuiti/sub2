importScripts("ecmUtils.js");

self.onmessage = async function(event) {
    const number = BigInt(event.data);
    console.log(`🚀 Worker: ECM を実行 (${number})`);

    self.postMessage({ type: "log", message: `🔄 Worker: ECM 実行開始 (${number})` });

    try {
        console.log("✅ ecm() を呼び出します！");  // ← 追加！
        const factor = await ecm(number, msg => self.postMessage({ type: "log", message: msg }));

        self.postMessage({ type: "log", message: `✅ Worker: ECM 終了 (${factor})` });
        self.postMessage({ type: "result", factor: factor ? factor.toString() : "null" });
    } catch (error) {
        self.postMessage({ type: "log", message: `❌ Worker: エラー発生 - ${error.message}` });
        self.postMessage({ type: "result", factor: "null" });
    }
};
