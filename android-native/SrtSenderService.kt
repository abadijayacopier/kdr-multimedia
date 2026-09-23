package com.kdrmultimedia.camera.srt

import android.content.Context
import android.util.Log

class SrtSenderService(private val context: Context) {
    private var running = false

    fun start(config: SrtSenderConfig) {
        require(config.endpoint.startsWith("srt://")) {
            "SRT endpoint must start with srt://"
        }
        if (running) return
        running = true
        Log.i("KDR-SRT", "SRT sender requested: " + config.endpoint)
    }

    fun stop() {
        if (!running) return
        running = false
        Log.i("KDR-SRT", "SRT sender stopped")
    }

    fun isRunning(): Boolean = running
}
