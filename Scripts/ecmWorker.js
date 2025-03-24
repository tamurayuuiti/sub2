importScripts("ecmUtils.js");

self.onmessage = async function(event) {
    const number = BigInt(event.data);
    console.log(`🚀 Worker: ECM を実行 (${number})`);

    self.postMessage({ type: "log", message: `🔄 Worker: ECM 実行開始 (${number})` });

    try {
        console.log("✅ ecm() を呼び出します！");
        
        setTimeout(() => console.log("⏳ 1秒経過... まだ動いているか？"), 1000);
        
        const factor = await ecm(number, msg => self.postMessage({ type: "log", message: msg }));

        if (!factor) {
            self.postMessage({ type: "log", message: "⚠️ 因数が見つからなかったため null を送信" });
        }

        self.postMessage({ type: "result", factor: factor ? factor.toString() : "null" });
    } catch (error) {
        self.postMessage({ type: "log", message: `❌ Worker: エラー発生 - ${error.message}` });
        self.postMessage({ type: "result", factor: "null" });
    }
};
