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
        if (endpoint == null || !endpoint.startsWith("srt://")) {
            call.reject("SRT endpoint is required");
            return;
        }

        String streamId = call.getString("streamId", "kdr-camera");
        String passphrase = call.getString("passphrase");
        int latencyMs = call.getInt("latencyMs", 120);
        int width = call.getInt("width", 1920);
        int height = call.getInt("height", 1080);
        int fps = call.getInt("fps", 30);
        int bitrate = call.getInt("bitrate", 4000000);
        boolean audio = call.getBoolean("audio", false);

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
