import { optimize } from "./optimizer.js";
self.onmessage = ({ data }) => {
  try {
    const result = optimize(data, (progress) =>
      self.postMessage({ type: "progress", progress }),
    );
    self.postMessage({ type: "result", result });
  } catch (error) {
    self.postMessage({ type: "error", message: error.message });
  }
};
