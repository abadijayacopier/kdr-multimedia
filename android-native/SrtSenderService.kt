package com.kdrmultimedia.camera.srt

import android.content.Context
import android.net.Uri
import android.util.Log
import android.util.Size
import io.github.thibaultbee.streampack.core.elements.sources.audio.audiorecord.MicrophoneSourceFactory
import io.github.thibaultbee.streampack.core.elements.sources.video.camera.CameraSourceFactory
import io.github.thibaultbee.streampack.core.elements.sources.video.camera.extensions.defaultCameraId
import io.github.thibaultbee.streampack.core.interfaces.startStream
import io.github.thibaultbee.streampack.core.streamers.single.AudioConfig
import io.github.thibaultbee.streampack.core.streamers.single.SingleStreamer
import io.github.thibaultbee.streampack.core.streamers.single.VideoConfig
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.cancel

/**
 * Native Android SRT sender.
 *
 * Pipeline:
 * Camera2 -> MediaCodec (H.264) -> MPEG-TS -> SRT
 *
 * The existing WebRTC/LAN/USB paths are intentionally untouched.
 */
class SrtSenderService(private val context: Context) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var streamJob: Job? = null
    private var streamer: SingleStreamer? = null
    private var running = false
    private var reconnecting = false
    private var lastConfig: SrtSenderConfig? = null
    private var lastError: String? = null

    fun start(config: SrtSenderConfig) {
        require(config.endpoint.startsWith("srt://")) { "SRT endpoint must start with srt://" }
        require(config.width > 0 && config.height > 0)
        require(config.fps in 1..60)
        require(config.bitrate > 0)

        stop()
        lastConfig = config
        lastError = null
        running = true

        streamJob = scope.launch {
            var attempt = 0
            while (running && lastConfig === config) {
                try {
                    reconnecting = attempt > 0
                    openAndStream(config)
                    attempt = 0
                    reconnecting = false

                    if (running) {
                        throw IllegalStateException("SRT stream stopped unexpectedly")
                    }
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (t: Throwable) {
                    lastError = t.message ?: t.javaClass.simpleName
                    Log.e(TAG, "SRT stream error: " + lastError, t)
                    closeStreamer()
                    if (!running || lastConfig !== config) break

                    attempt++
                    reconnecting = true
                    val backoffMs = minOf(8000L, 1000L * (1L shl minOf(attempt - 1, 3)))
                    delay(backoffMs)
                }
            }
            reconnecting = false
        }
    }

    fun stop() {
        running = false
        reconnecting = false
        streamJob?.cancel()
        streamJob = null
        closeStreamerAsync()
        lastConfig = null
        Log.i(TAG, "Native SRT sender stopped")
    }

    fun isRunning(): Boolean = running
    fun isReconnecting(): Boolean = reconnecting
    fun lastError(): String? = lastError
    fun currentConfig(): SrtSenderConfig? = lastConfig

    private suspend fun openAndStream(config: SrtSenderConfig) {
        val endpoint = buildSrtEndpoint(config)

        val cameraStreamer = SingleStreamer(context.applicationContext)
        streamer = cameraStreamer

        // StreamPack 3.2.x selects the camera through the video source factory.
        cameraStreamer.videoInput.setSource(
            CameraSourceFactory(context.applicationContext.defaultCameraId)
        )

        if (config.audio) {
            cameraStreamer.audioInput.setSource(MicrophoneSourceFactory())
            cameraStreamer.setAudioConfig(AudioConfig())
        }

        val videoConfig = VideoConfig(
            startBitrate = config.bitrate,
            resolution = Size(config.width, config.height),
            fps = config.fps
        )
        cameraStreamer.setVideoConfig(videoConfig)

        Log.i(TAG, "Starting SRT caller: " + endpoint)
        cameraStreamer.startStream(endpoint)
    }

    private suspend fun closeStreamer() {
        val current = streamer ?: return
        try {
            current.stopStream()
            current.close()
            current.release()
        } catch (t: Throwable) {
            Log.w(TAG, "Error while closing SRT streamer: " + t.message)
        } finally {
            streamer = null
        }
    }

    private fun closeStreamerAsync() {
        scope.launch {
            closeStreamer()
        }
    }

    private fun buildSrtEndpoint(config: SrtSenderConfig): String {
        val base = config.endpoint.substringBefore('?')
        val query = linkedMapOf(
            "mode" to "caller",
            "streamid" to config.streamId,
            "latency" to config.latencyMs.toString()
        )
        if (!config.passphrase.isNullOrBlank()) {
            query["passphrase"] = config.passphrase
        }

        return base + "?" + query.entries.joinToString("&") {
            it.key + "=" + Uri.encode(it.value)
        }
    }

    fun release() {
        stop()
        scope.cancel()
    }

    companion object {
        private const val TAG = "KDR-SRT"
    }
}
