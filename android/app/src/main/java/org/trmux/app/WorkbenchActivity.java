package org.trmux.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputFilter;
import android.text.InputType;
import android.view.Gravity;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;

/** Native, offline-first workbench tools hosted in the Android app (no shell execution). */
public final class WorkbenchActivity extends Activity {
    private static final int OPEN_FILE = 31;
    private static final int SAVE_FILE = 32;
    private static final int MAX_FILE_BYTES = 1024 * 1024;
    private static final String LOCAL_OLLAMA = "http://127.0.0.1:11434";
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private LinearLayout content;
    private TextView status;
    private EditText editor;
    private EditText logInput;
    private EditText chatInput;
    private EditText chatModel;
    private TextView chatOutput;
    private String currentFileName = "Untitled";

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        buildShell();
        showEditor();
    }

    private void buildShell() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(16), dp(12), dp(16), dp(12));
        root.setBackgroundColor(0xff10131b);
        TextView title = new TextView(this);
        title.setText("TRMUX · NATIVE WORKBENCH");
        title.setTextColor(0xff94f2c0);
        title.setTextSize(20);
        title.setGravity(Gravity.CENTER_VERTICAL);
        root.addView(title, new LinearLayout.LayoutParams(-1, dp(48)));
        LinearLayout nav = new LinearLayout(this);
        addNavButton(nav, "Editor", this::showEditor);
        addNavButton(nav, "Log review", this::showLogReview);
        addNavButton(nav, "Local AI", this::showChat);
        addNavButton(nav, "VPN", () -> startActivity(new Intent(this, MainActivity.class)));
        root.addView(nav);
        ScrollView scroll = new ScrollView(this);
        content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(0, dp(12), 0, dp(12));
        scroll.addView(content);
        root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
        status = new TextView(this);
        status.setTextColor(0xffb7c1d1);
        status.setTextSize(12);
        status.setPadding(0, dp(8), 0, 0);
        status.setText("Ready · files and AI stay on this device");
        root.addView(status);
        setContentView(root);
    }

    private void addNavButton(LinearLayout row, String label, Runnable action) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextSize(11);
        button.setOnClickListener(v -> action.run());
        row.addView(button, new LinearLayout.LayoutParams(0, -2, 1));
    }

    private void showEditor() {
        content.removeAllViews();
        heading("Local file editor", "Open or save text files using Android's document picker. No files are uploaded.");
        LinearLayout actions = new LinearLayout(this);
        addNavButton(actions, "Open file", this::openFile);
        addNavButton(actions, "Save as", this::saveFile);
        content.addView(actions);
        editor = new EditText(this);
        editor.setGravity(Gravity.TOP | Gravity.START);
        editor.setTextSize(13);
        editor.setTypeface(android.graphics.Typeface.MONOSPACE);
        editor.setMinLines(14);
        editor.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        editor.setFilters(new InputFilter[]{new InputFilter.LengthFilter(MAX_FILE_BYTES)});
        editor.setHint("Open a text file, or start typing…");
        content.addView(editor, new LinearLayout.LayoutParams(-1, dp(360)));
        setStatus("Editing " + currentFileName + " · local only");
    }

    private void openFile() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("text/*");
        startActivityForResult(intent, OPEN_FILE);
    }

    private void saveFile() {
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("text/plain");
        intent.putExtra(Intent.EXTRA_TITLE, currentFileName.equals("Untitled") ? "notes.txt" : currentFileName);
        startActivityForResult(intent, SAVE_FILE);
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (resultCode != RESULT_OK || data == null || data.getData() == null) return;
        Uri uri = data.getData();
        if (requestCode == OPEN_FILE) {
            worker.execute(() -> {
                try (InputStream input = getContentResolver().openInputStream(uri)) {
                    if (input == null) throw new IllegalStateException("Could not open selected file.");
                    String text = new String(readBounded(input, MAX_FILE_BYTES), StandardCharsets.UTF_8);
                    String name = uri.getLastPathSegment() == null ? "Selected file" : uri.getLastPathSegment();
                    runOnUiThread(() -> {
                        currentFileName = name;
                        if (editor != null) editor.setText(text);
                        setStatus("Opened " + name + " · kept on device");
                    });
                } catch (Exception e) { setStatus("Open failed: " + safeMessage(e)); }
            });
        } else if (requestCode == SAVE_FILE) {
            String text = editor == null ? "" : editor.getText().toString();
            if (text.getBytes(StandardCharsets.UTF_8).length > MAX_FILE_BYTES) {
                setStatus("Save failed: text exceeds 1 MiB.");
                return;
            }
            worker.execute(() -> {
                try (OutputStream output = getContentResolver().openOutputStream(uri, "wt")) {
                    if (output == null) throw new IllegalStateException("Could not write selected document.");
                    output.write(text.getBytes(StandardCharsets.UTF_8));
                    currentFileName = uri.getLastPathSegment() == null ? "Saved file" : uri.getLastPathSegment();
                    setStatus("Saved " + currentFileName + " · local only");
                } catch (Exception e) { setStatus("Save failed: " + safeMessage(e)); }
            });
        }
    }

    private void showLogReview() {
        content.removeAllViews();
        heading("Defensive log review", "Local heuristic matches are indicators only—not proof of compromise. Input is not retained.");
        logInput = new EditText(this);
        logInput.setGravity(Gravity.TOP | Gravity.START);
        logInput.setMinLines(10);
        logInput.setMaxLines(18);
        logInput.setFilters(new InputFilter[]{new InputFilter.LengthFilter(100000)});
        logInput.setTextSize(12);
        logInput.setTypeface(android.graphics.Typeface.MONOSPACE);
        logInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        logInput.setHint("Paste log lines here…");
        content.addView(logInput, new LinearLayout.LayoutParams(-1, dp(280)));
        Button analyze = new Button(this);
        analyze.setText("Review locally");
        analyze.setOnClickListener(v -> analyzeLogs());
        content.addView(analyze);
    }

    private void analyzeLogs() {
        String text = logInput.getText().toString();
        if (text.isEmpty() || text.length() > 100000) {
            setStatus("Paste between 1 and 100,000 characters to review.");
            return;
        }
        Pattern indicators = Pattern.compile("(?i)(failed|invalid|denied).{0,50}(login|logon|authentication|password)|(sudo|elevation|privilege).{0,60}(granted|changed|escalat)|(powershell.{0,80}(-enc|encodedcommand)|curl\\s+[^\\n|]+\\|\\s*(sh|bash))");
        StringBuilder findings = new StringBuilder();
        String[] lines = text.split("\\r?\\n", -1);
        int count = 0;
        for (int i = 0; i < lines.length; i++) {
            if (indicators.matcher(lines[i]).find()) {
                findings.append("Line ").append(i + 1).append(": ")
                        .append(lines[i].substring(0, Math.min(180, lines[i].length()))).append('\n');
                count++;
                if (count >= 200) { findings.append("Further findings omitted.\n"); break; }
            }
        }
        TextView result = new TextView(this);
        result.setTextColor(0xffe6e9f0);
        result.setTextSize(12);
        result.setPadding(0, dp(12), 0, 0);
        result.setText(count == 0 ? "No configured indicators found. This does not establish that the logs are safe." : count + " possible indicator(s):\n" + findings);
        content.addView(result);
        setStatus("Reviewed " + lines.length + " lines in memory; no data retained.");
    }

    private void showChat() {
        content.removeAllViews();
        heading("Local model chat", "Connects only to Ollama at 127.0.0.1 on this device. No hosted AI, command execution, or file modification.");
        chatModel = new EditText(this);
        chatModel.setSingleLine(true);
        chatModel.setHint("Choose an installed Ollama model");
        content.addView(chatModel);
        Button listModels = new Button(this);
        listModels.setText("Find local models");
        listModels.setOnClickListener(v -> fetchModels());
        content.addView(listModels);
        chatInput = new EditText(this);
        chatInput.setGravity(Gravity.TOP | Gravity.START);
        chatInput.setMinLines(3);
        chatInput.setFilters(new InputFilter[]{new InputFilter.LengthFilter(4000)});
        chatInput.setHint("Ask a question…");
        content.addView(chatInput, new LinearLayout.LayoutParams(-1, dp(130)));
        Button send = new Button(this);
        send.setText("Ask local model");
        send.setOnClickListener(v -> sendChat());
        content.addView(send);
        chatOutput = new TextView(this);
        chatOutput.setTextColor(0xffe6e9f0);
        chatOutput.setTextSize(14);
        chatOutput.setPadding(0, dp(14), 0, dp(8));
        content.addView(chatOutput);
    }

    private void fetchModels() {
        setStatus("Checking local Ollama…");
        worker.execute(() -> {
            try {
                JSONObject data = new JSONObject(localRequest("/api/tags", null, 2 * 1024 * 1024));
                JSONArray models = data.optJSONArray("models");
                List<String> names = new ArrayList<>();
                if (models != null) for (int i = 0; i < models.length(); i++) {
                    String name = models.optJSONObject(i) == null ? null : models.optJSONObject(i).optString("name", "");
                    if (!name.isEmpty()) names.add(name);
                }
                runOnUiThread(() -> {
                    if (names.isEmpty()) { setStatus("Ollama is reachable, but no local models are installed."); return; }
                    CharSequence[] choices = names.toArray(new CharSequence[0]);
                    new AlertDialog.Builder(this).setTitle("Installed local models")
                            .setItems(choices, (dialog, which) -> chatModel.setText(names.get(which))).show();
                    setStatus(names.size() + " local model(s) found.");
                });
            } catch (Exception e) { setStatus("Local Ollama unavailable: " + safeMessage(e)); }
        });
    }

    private void sendChat() {
        String model = chatModel.getText().toString().trim();
        String prompt = chatInput.getText().toString().trim();
        if (model.isEmpty() || prompt.isEmpty()) { setStatus("Choose an installed model and enter a question."); return; }
        if (model.length() > 200 || prompt.length() > 4000) { setStatus("Model name or prompt is too long."); return; }
        chatOutput.setText("Thinking locally…");
        worker.execute(() -> {
            try {
                JSONObject request = new JSONObject();
                request.put("model", model);
                request.put("stream", false);
                request.put("messages", new JSONArray().put(new JSONObject().put("role", "user").put("content", prompt)));
                JSONObject response = new JSONObject(localRequest("/api/chat", request.toString(), 1024 * 1024));
                JSONObject message = response.optJSONObject("message");
                String answer = message == null ? "(No answer returned.)" : message.optString("content", "(No answer returned.)");
                runOnUiThread(() -> { if (chatOutput != null) chatOutput.setText(answer); setStatus("Response received from local Ollama."); });
            } catch (Exception e) {
                runOnUiThread(() -> { if (chatOutput != null) chatOutput.setText("Could not reach the local model. Start Ollama on this device and try again.\n\n" + safeMessage(e)); setStatus("Local AI request failed."); });
            }
        });
    }

    private String localRequest(String path, String body, int maxBytes) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(LOCAL_OLLAMA + path).openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(3000);
        connection.setReadTimeout(path.endsWith("/chat") ? 120000 : 5000);
        connection.setRequestMethod(body == null ? "GET" : "POST");
        connection.setRequestProperty("Accept", "application/json");
        if (body != null) {
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            if (bytes.length > 10000) throw new IllegalArgumentException("Chat request exceeds limit.");
            try (OutputStream output = connection.getOutputStream()) { output.write(bytes); }
        }
        try {
            int code = connection.getResponseCode();
            InputStream stream = code >= 200 && code < 300 ? connection.getInputStream() : connection.getErrorStream();
            if (stream == null) throw new IllegalStateException("Local Ollama returned HTTP " + code + ".");
            String response;
            try (InputStream input = stream) { response = new String(readBounded(input, maxBytes), StandardCharsets.UTF_8); }
            if (code < 200 || code >= 300) throw new IllegalStateException("Local Ollama returned HTTP " + code + ".");
            return response;
        } finally { connection.disconnect(); }
    }

    private static byte[] readBounded(InputStream input, int limit) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[4096];
        int count;
        while ((count = input.read(buffer)) != -1) {
            if (out.size() + count > limit) throw new IllegalArgumentException("Selected data exceeds the size limit.");
            out.write(buffer, 0, count);
        }
        return out.toByteArray();
    }

    private void heading(String title, String detail) {
        TextView h = new TextView(this); h.setText(title); h.setTextColor(0xffffffff); h.setTextSize(21); h.setPadding(0, dp(4), 0, dp(6)); content.addView(h);
        TextView p = new TextView(this); p.setText(detail); p.setTextColor(0xffb9c2d0); p.setTextSize(13); p.setPadding(0, 0, 0, dp(14)); content.addView(p);
    }

    private void setStatus(String text) { runOnUiThread(() -> { if (status != null) status.setText(text); }); }
    private String safeMessage(Exception e) { String message=e.getMessage(); if(message==null||message.isBlank())return e.getClass().getSimpleName(); return message.length()>180?message.substring(0,180):message; }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    @Override protected void onDestroy() { worker.shutdownNow(); super.onDestroy(); }
}
