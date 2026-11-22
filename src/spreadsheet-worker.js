import { parseMeasurementWorkbook } from "./spreadsheet.js";
self.onmessage = ({ data }) => {
  try {
    self.postMessage({ workbook: parseMeasurementWorkbook(data) });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
