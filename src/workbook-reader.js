export async function readMeasurementFile(file, signal) {
  const buffer = await file.arrayBuffer();
  if (signal?.aborted) throw new DOMException("Import cancelled", "AbortError");
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./spreadsheet-worker.js", import.meta.url),
      { type: "module" },
    );
    const cleanup = () => {
      worker.terminate();
      signal?.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("Import cancelled", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    worker.onmessage = ({ data }) => {
      cleanup();
      data.error ? reject(new Error(data.error)) : resolve(data.workbook);
    };
    worker.onerror = () => {
      cleanup();
      reject(
        new Error(
          "The spreadsheet could not be read. Try an unencrypted XLSX, ODS or CSV export; large files may exceed device memory.",
        ),
      );
    };
    worker.postMessage(buffer, [buffer]);
  });
}
