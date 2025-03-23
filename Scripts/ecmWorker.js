importScripts("ecmUtils.js");

self.onmessage = async function(event) {
    const number = BigInt(event.data);
    self.postMessage({ type: "log", message: `🔄 Worker: ECM 実行中 (${number})` });

    const factor = await ecm(number, msg => self.postMessage({ type: "log", message: msg }));

    self.postMessage({ type: "result", factor: factor.toString() });
};
