package io.github.leonbalongo.cutcraft;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Uses Android's print framework, including the system Save as PDF destination. */
@CapacitorPlugin(name = "CutcraftPrint")
public class CutcraftPrintPlugin extends Plugin {
    @PluginMethod
    public void print(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                PrintManager manager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                if (manager == null) {
                    call.reject("No Android print service is available on this device.");
                    return;
                }
                PrintDocumentAdapter document = getBridge().getWebView()
                    .createPrintDocumentAdapter("Cutcraft cutting plan");
                PrintAttributes attributes = new PrintAttributes.Builder()
                    .setMediaSize(PrintAttributes.MediaSize.ISO_A4.asLandscape())
                    .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
                    .build();
                manager.print("Cutcraft cutting plan", document, attributes);
                call.resolve();
            } catch (Exception error) {
                call.reject("Unable to open the Android print dialog.", error);
            }
        });
    }
}
