import { Capacitor, registerPlugin } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export const isNative = () => Capacitor.isNativePlatform();
const CutcraftPrint = registerPlugin("CutcraftPrint");

// Android WebView does not download blob: URLs through an <a download> link.
// Export privately to the cache, then grant a temporary URI to the user's
// chosen app via Android's share sheet. No broad storage permission required.
export async function shareNativeFile(
  name,
  content,
  services = { Filesystem, Share },
) {
  if (!name || /[/\\]/.test(name) || name === "." || name === "..") {
    throw new Error("Invalid export filename.");
  }
  const binary = content instanceof ArrayBuffer || ArrayBuffer.isView(content);
  let data = content;
  if (binary) {
    const bytes =
      content instanceof ArrayBuffer
        ? new Uint8Array(content)
        : new Uint8Array(
            content.buffer,
            content.byteOffset,
            content.byteLength,
          );
    let text = "";
    for (let i = 0; i < bytes.length; i += 32768)
      text += String.fromCharCode(...bytes.subarray(i, i + 32768));
    data = btoa(text);
  }
  const { uri } = await services.Filesystem.writeFile({
    path: `exports/${name}`,
    data,
    directory: Directory.Cache,
    ...(binary ? {} : { encoding: Encoding.UTF8 }),
    recursive: true,
  });
  await services.Share.share({
    title: name,
    dialogTitle: "Save or share your Cutcraft export",
    files: [uri],
  });
}

export async function printNativePlan() {
  // Allow the freshly inserted print section to reach the WebView layout.
  await new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  );
  await CutcraftPrint.print();
}
