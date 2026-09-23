package com.kdrmultimedia.camera.srt;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "KdrSrt")
public class KdrSrtPlugin extends Plugin {
    private SrtSenderService sender;

    private SrtSenderService sender() {
        if (sender == null) {
            sender = new SrtSenderService(getContext().getApplicationContext());
        }
        return sender;
    }

    @Override
    protected void handleOnDestroy() {
        if (sender != null) {
            sender.release();
            sender = null;
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void start(PluginCall call) {
        String endpoint = call.getString("endpoint");
        if (endpoint == null || !endpoint.trim().startsWith("srt://")) {
            call.reject("SRT endpoint is required and must start with srt://");
            return;
        }

        endpoint = endpoint.trim();
        String streamId = call.getString("streamId", "kdr-camera");
        String passphrase = call.getString("passphrase");
        int latencyMs = call.getInt("latencyMs", 120);
        int width = call.getInt("width", 1920);
        int height = call.getInt("height", 1080);
        int fps = call.getInt("fps", 30);
        int bitrate = call.getInt("bitrate", 4000000);
        boolean audio = call.getBoolean("audio", false);

        if (streamId == null || streamId.trim().isEmpty()) {
            call.reject("SRT streamId is required");
            return;
        }
        if (latencyMs < 20 || latencyMs > 10000) {
            call.reject("SRT latency must be between 20 and 10000 ms");
            return;
        }
        if (width < 320 || width > 3840 || height < 240 || height > 2160) {
            call.reject("Unsupported SRT video resolution");
            return;
        }
        if (fps < 1 || fps > 60) {
            call.reject("SRT FPS must be between 1 and 60");
            return;
        }
        if (bitrate < 250000 || bitrate > 50000000) {
            call.reject("SRT bitrate must be between 250 Kbps and 50 Mbps");
            return;
        }
        if (passphrase != null && !passphrase.isEmpty() && (passphrase.length() < 10 || passphrase.length() > 79)) {
            call.reject("SRT passphrase must be 10-79 characters");
            return;
        }

        try {
            sender().start(new SrtSenderConfig(
                endpoint, streamId, passphrase, latencyMs,
                width, height, fps, bitrate, audio
            ));
            call.resolve(statusObject());
        } catch (Throwable t) {
            call.reject(t.getMessage() == null ? "Failed to start SRT" : t.getMessage(), new Exception(t));
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        sender().stop();
        call.resolve(statusObject());
    }

    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(statusObject());
    }

    private JSObject statusObject() {
        JSObject result = new JSObject();
        result.put("running", sender().isRunning());
        result.put("reconnecting", sender().isReconnecting());
        result.put("error", sender().lastError());
        return result;
    }
}
