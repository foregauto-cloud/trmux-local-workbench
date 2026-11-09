package org.trmux.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** AES-GCM profile-at-rest storage backed by Android Keystore. */
final class SecureProfileStore {
    private static final String STORE = "trmux_secure_profile";
    private static final String KEY_ALIAS = "trmux_wireguard_profile_v1";
    private static final String CIPHER = "AES/GCM/NoPadding";
    private final SharedPreferences preferences;
    private final KeyStore keyStore;

    SecureProfileStore(Context context) {
        preferences = context.getSharedPreferences(STORE, Context.MODE_PRIVATE);
        try { keyStore = KeyStore.getInstance("AndroidKeyStore"); keyStore.load(null); }
        catch (Exception e) { throw new IllegalStateException("Android secure storage is unavailable.", e); }
    }

    boolean exists() { return preferences.contains("ciphertext") && preferences.contains("iv"); }
    String getName() { return preferences.getString("name", "WireGuard"); }

    void save(String config) throws Exception {
        SecretKey key = getOrCreateKey();
        Cipher cipher = Cipher.getInstance(CIPHER);
        cipher.init(Cipher.ENCRYPT_MODE, key);
        byte[] ciphertext = cipher.doFinal(config.getBytes(StandardCharsets.UTF_8));
        preferences.edit().putString("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
                .putString("ciphertext", Base64.encodeToString(ciphertext, Base64.NO_WRAP))
                .putString("name", "Imported WireGuard profile").apply();
    }

    String read() throws Exception {
        if (!exists()) throw new IllegalStateException("No profile is saved.");
        byte[] iv = Base64.decode(preferences.getString("iv", ""), Base64.NO_WRAP);
        byte[] ciphertext = Base64.decode(preferences.getString("ciphertext", ""), Base64.NO_WRAP);
        Cipher cipher = Cipher.getInstance(CIPHER);
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(128, iv));
        return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
    }

    private SecretKey getOrCreateKey() throws Exception {
        if (keyStore.containsAlias(KEY_ALIAS)) return (SecretKey) keyStore.getKey(KEY_ALIAS, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build());
        return generator.generateKey();
    }
}
