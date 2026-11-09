package org.trmux.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.net.VpnService;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import com.wireguard.android.backend.Backend;
import com.wireguard.android.backend.GoBackend;
import com.wireguard.android.backend.Tunnel;
import com.wireguard.config.Config;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Minimal native Android WireGuard controller with user-confirmed APK update handoff. */
public final class MainActivity extends Activity {
    private static final int REQUEST_IMPORT = 10;
    private static final int REQUEST_VPN_PERMISSION = 11;
    private static final int REQUEST_UPDATE_APK = 12;
    private static final int REQUEST_UNKNOWN_APP_SOURCES = 13;
    private static final String TUNNEL_NAME = "trmux";
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private SecureProfileStore profileStore;
    private Backend backend;
    private final Tunnel tunnel = new Tunnel() {
        @Override public String getName() { return TUNNEL_NAME; }
        @Override public void onStateChange(State state) { showStatus("Tunnel " + state.name().toLowerCase()); }
    };
    private TextView status;
    private TextView profileName;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        profileStore = new SecureProfileStore(this);
        buildUi();
        showProfile();
        worker.execute(() -> {
            try {
                backend = new GoBackend(getApplicationContext());
                refreshState();
            } catch (Exception e) { showStatus("WireGuard backend could not initialize: " + safeMessage(e)); }
        });
    }

    private void buildUi() {
        int pad = dp(20);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(pad, pad, pad, pad);
        root.setBackgroundColor(0xff10131b);

        TextView title = new TextView(this);
        title.setText("TRMUX  ·  ANDROID VPN");
        title.setTextColor(0xff94f2c0);
        title.setTextSize(20);
        title.setGravity(Gravity.CENTER_VERTICAL);
        root.addView(title, new LinearLayout.LayoutParams(-1, dp(52)));

        TextView explanation = new TextView(this);
        explanation.setText("Native WireGuard tunnel control. Import a configuration you are authorized to use. Android will ask for VPN consent before the first connection.");
        explanation.setTextColor(0xffc2c9d6);
        explanation.setTextSize(14);
        root.addView(explanation, new LinearLayout.LayoutParams(-1, -2));

        profileName = new TextView(this);
        profileName.setTextColor(0xffffffff);
        profileName.setTextSize(16);
        profileName.setPadding(0, dp(24), 0, dp(12));
        root.addView(profileName);

        status = new TextView(this);
        status.setTextColor(0xff94f2c0);
        status.setTextSize(14);
        status.setPadding(0, dp(10), 0, dp(18));
        root.addView(status);

        Button importButton = new Button(this);
        importButton.setText("Import WireGuard .conf");
        importButton.setOnClickListener(v -> chooseConfig());
        root.addView(importButton, new LinearLayout.LayoutParams(-1, -2));

        Button connectButton = new Button(this);
        connectButton.setText("Connect");
        connectButton.setOnClickListener(v -> requestConnect());
        root.addView(connectButton, new LinearLayout.LayoutParams(-1, -2));

        Button disconnect = new Button(this);
        disconnect.setText("Disconnect");
        disconnect.setOnClickListener(v -> disconnect());
        root.addView(disconnect, new LinearLayout.LayoutParams(-1, -2));

        Button updateButton = new Button(this);
        updateButton.setText("Install app update from APK");
        updateButton.setOnClickListener(v -> requestUpdate());
        root.addView(updateButton, new LinearLayout.LayoutParams(-1, -2));

        TextView updateInfo = new TextView(this);
        updateInfo.setText("Updates are user-selected APK files installed by Android. The installer checks package/signature compatibility and asks for confirmation. Build updates with the same signing key and a higher version code. The app cannot patch its running code or silently install itself; Android restarts it after an update.");
        updateInfo.setTextColor(0xff939cad);
        updateInfo.setTextSize(12);
        updateInfo.setPadding(0, dp(10), 0, 0);
        root.addView(updateInfo, new LinearLayout.LayoutParams(-1, -2));

        TextView limits = new TextView(this);
        limits.setText("Privacy: the profile is encrypted with an Android Keystore key and stays on this device. This app does not run a proxy, collect credentials, rotate endpoints, or upload telemetry. Disconnect and verify your device’s VPN status if the tunnel fails.");
        limits.setTextColor(0xff939cad);
        limits.setTextSize(12);
        limits.setPadding(0, dp(18), 0, 0);
        root.addView(limits, new LinearLayout.LayoutParams(-1, -2));

        ScrollView scroll = new ScrollView(this);
        scroll.addView(root);
        setContentView(scroll);
    }

    private void chooseConfig() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("text/plain");
        startActivityForResult(intent, REQUEST_IMPORT);
    }

    private void requestUpdate() {
        showStatus("Checking tunnel state before update…");
        worker.execute(() -> {
            try {
                if (backend == null) throw new IllegalStateException("VPN backend is still initializing.");
                if (backend.getState(tunnel) == Tunnel.State.UP) throw new IllegalStateException("Disconnect the VPN before updating the app.");
                runOnUiThread(this::requestInstallPermissionAndPickApk);
            } catch (Exception e) { showStatus("Update not started: " + safeMessage(e)); }
        });
    }

    private void requestInstallPermissionAndPickApk() {
        if (!getPackageManager().canRequestPackageInstalls()) {
            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getPackageName()));
            startActivityForResult(settings, REQUEST_UNKNOWN_APP_SOURCES);
            return;
        }
        chooseUpdateApk();
    }

    private void chooseUpdateApk() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/vnd.android.package-archive");
        startActivityForResult(intent, REQUEST_UPDATE_APK);
    }

    private void launchSystemInstaller(Uri apkUri) {
        Intent install = new Intent(Intent.ACTION_VIEW);
        install.setDataAndType(apkUri, "application/vnd.android.package-archive");
        install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try {
            startActivity(install);
            showStatus("Android package installer opened. Review the app and confirm the update there.");
        } catch (Exception e) {
            showStatus("Could not open Android package installer: " + safeMessage(e));
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_UNKNOWN_APP_SOURCES) {
            if (getPackageManager().canRequestPackageInstalls()) chooseUpdateApk();
            else showStatus("Install permission was not enabled; no update was installed.");
            return;
        }
        if (resultCode != RESULT_OK || data == null || data.getData() == null) return;
        if (requestCode == REQUEST_IMPORT) {
            try (InputStream in = getContentResolver().openInputStream(data.getData())) {
                if (in == null) throw new IllegalArgumentException("Could not read selected configuration.");
                byte[] bytes = readBounded(in, 65536);
                String configText = new String(bytes, StandardCharsets.UTF_8);
                Config.parse(new ByteArrayInputStream(bytes));
                profileStore.save(configText);
                showProfile();
                showStatus("Valid WireGuard configuration imported and encrypted on device.");
            } catch (Exception e) { showStatus("Import failed: " + safeMessage(e)); }
        } else if (requestCode == REQUEST_VPN_PERMISSION) {
            if (resultCode == RESULT_OK) connect();
            else showStatus("Android VPN permission was not granted; tunnel remains disconnected.");
        } else if (requestCode == REQUEST_UPDATE_APK) {
            Uri apkUri = data.getData();
            worker.execute(() -> {
                try {
                    if (backend == null || backend.getState(tunnel) == Tunnel.State.UP)
                        throw new IllegalStateException("Disconnect the VPN before installing an update.");
                    runOnUiThread(() -> launchSystemInstaller(apkUri));
                } catch (Exception e) { showStatus("Update not started: " + safeMessage(e)); }
            });
        }
    }

    private static byte[] readBounded(InputStream input, int maxBytes) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[4096];
        int total = 0;
        int count;
        while ((count = input.read(buffer)) != -1) {
            total += count;
            if (total > maxBytes) throw new IllegalArgumentException("Config exceeds 64 KiB.");
            output.write(buffer, 0, count);
        }
        return output.toByteArray();
    }

    private void requestConnect() {
        if (profileStore == null || !profileStore.exists()) { showStatus("Import a WireGuard profile first."); return; }
        Intent consent = VpnService.prepare(this);
        if (consent != null) startActivityForResult(consent, REQUEST_VPN_PERMISSION);
        else connect();
    }

    private void connect() {
        showStatus("Connecting…");
        worker.execute(() -> {
            try {
                if (backend == null) backend = new GoBackend(getApplicationContext());
                String text = profileStore.read();
                Config config = Config.parse(new ByteArrayInputStream(text.getBytes(StandardCharsets.UTF_8)));
                backend.setState(tunnel, Tunnel.State.UP, config);
                showStatus("Connected · WireGuard");
            } catch (Exception e) { showStatus("Connection failed: " + safeMessage(e)); }
        });
    }

    private void disconnect() {
        showStatus("Disconnecting…");
        worker.execute(() -> {
            try {
                if (backend != null) backend.setState(tunnel, Tunnel.State.DOWN, null);
                showStatus("Disconnected");
            } catch (Exception e) { showStatus("Disconnect error: " + safeMessage(e)); }
        });
    }

    private void refreshState() {
        try {
            boolean up = backend.getState(tunnel) == Tunnel.State.UP;
            showStatus(up ? "Connected · WireGuard" : "Disconnected");
        } catch (Exception e) { showStatus("Tunnel status unavailable: " + safeMessage(e)); }
    }

    private void showProfile() {
        if (profileName == null) return;
        profileName.setText(profileStore != null && profileStore.exists() ? "Saved profile: " + profileStore.getName() : "No WireGuard profile imported");
    }

    private void showStatus(String message) {
        runOnUiThread(() -> { if (status != null) status.setText(message); });
    }

    private String safeMessage(Exception e) {
        String message = e.getMessage();
        if (message == null || message.isBlank()) return e.getClass().getSimpleName();
        return message.length() > 160 ? message.substring(0, 160) : message;
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    @Override protected void onDestroy() {
        worker.shutdown();
        super.onDestroy();
    }
}
