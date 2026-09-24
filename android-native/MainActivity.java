package com.kdrmultimedia.camera;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;

import com.getcapacitor.BridgeActivity;
import com.kdrmultimedia.camera.srt.KdrSrtPlugin;

public class MainActivity extends BridgeActivity {
    private static final int WEB_PERMISSION_REQUEST = 7001;
    private PermissionRequest pendingWebPermissionRequest;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KdrSrtPlugin.class);
        super.onCreate(savedInstanceState);

        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setWebChromeClient(new WebChromeClient() {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    runOnUiThread(() -> handleWebPermissionRequest(request));
                }
            });
        }
    }

    private void handleWebPermissionRequest(PermissionRequest request) {
        String[] resources = request.getResources();
        boolean needsCamera = false;
        boolean needsAudio = false;

        for (String resource : resources) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) needsCamera = true;
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) needsAudio = true;
        }

        boolean cameraGranted = !needsCamera ||
                checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
        boolean audioGranted = !needsAudio ||
                checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;

        if (cameraGranted && audioGranted) {
            request.grant(resources);
            return;
        }

        pendingWebPermissionRequest = request;

        java.util.ArrayList<String> permissions = new java.util.ArrayList<>();
        if (needsCamera && !cameraGranted) permissions.add(Manifest.permission.CAMERA);
        if (needsAudio && !audioGranted) permissions.add(Manifest.permission.RECORD_AUDIO);

        requestPermissions(
                permissions.toArray(new String[0]),
                WEB_PERMISSION_REQUEST
        );
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            String[] permissions,
            int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode != WEB_PERMISSION_REQUEST || pendingWebPermissionRequest == null) return;

        PermissionRequest request = pendingWebPermissionRequest;
        pendingWebPermissionRequest = null;

        boolean allGranted = grantResults.length > 0;
        for (int result : grantResults) {
            if (result != PackageManager.PERMISSION_GRANTED) {
                allGranted = false;
                break;
            }
        }

        if (allGranted) {
            request.grant(request.getResources());
        } else {
            request.deny();
        }
    }

    @Override
    protected void onDestroy() {
        if (pendingWebPermissionRequest != null) {
            pendingWebPermissionRequest.deny();
            pendingWebPermissionRequest = null;
        }
        super.onDestroy();
    }
}
