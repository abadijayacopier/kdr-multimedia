package com.kdrmultimedia.camera.srt

data class SrtSenderConfig(
    val endpoint: String,
    val streamId: String = "kdr-camera",
    val passphrase: String? = null,
    val latencyMs: Int = 120,
    val width: Int = 1920,
    val height: Int = 1080,
    val fps: Int = 30,
    val bitrate: Int = 4_000_000,
    val audio: Boolean = false
)
