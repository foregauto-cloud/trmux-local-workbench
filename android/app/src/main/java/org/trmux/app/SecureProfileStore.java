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
    private static final int MAX_PROFILE_BYTES = 65536;
    private static final int GCM_IV_BYTES = 12;
    private static final int GCM_TAG_BYTES = 16;
    private final SharedPreferences preferences;
    private final KeyStore keyStore;

    SecureProfileStore(Context context) {
        preferences = context.getSharedPreferences(STORE, Context.MODE_PRIVATE);
        try {
            keyStore = KeyStore.getInstance("AndroidKeyStore");
            keyStore.load(null);
        } catch (Exception e) {
            throw new IllegalStateException("Android secure storage is unavailable.", e);
        }
    }

    boolean exists() { return preferences.contains("ciphertext") && preferences.contains("iv"); }
    String getName() { return preferences.getString("name", "WireGuard"); }

    void save(String config) throws Exception {
        byte[] plaintext = config.getBytes(StandardCharsets.UTF_8);
        if (plaintext.length == 0 || plaintext.length > MAX_PROFILE_BYTES)
            throw new IllegalArgumentException("WireGuard profile must be between 1 byte and 64 KiB.");
        Cipher cipher = Cipher.getInstance(CIPHER);
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
        byte[] iv = cipher.getIV();
        if (iv == null || iv.length != GCM_IV_BYTES)
            throw new IllegalStateException("Unexpected AES-GCM IV length.");
        byte[] ciphertext = cipher.doFinal(plaintext);
        boolean saved = preferences.edit()
                .putString("iv", Base64.encodeToString(iv, Base64.NO_WRAP))
                .putString("ciphertext", Base64.encodeToString(ciphertext, Base64.NO_WRAP))
                .putString("name", "Imported WireGuard profile")
                .commit();
        if (!saved) throw new IllegalStateException("Could not durably save the encrypted profile.");
    }

    String read() throws Exception {
        if (!exists()) throw new IllegalStateException("No profile is saved.");
        String encodedIv = preferences.getString("iv", null);
        String encodedCiphertext = preferences.getString("ciphertext", null);
        if (encodedIv == null || encodedCiphertext == null)
            throw new IllegalStateException("Saved profile data is incomplete.");
        byte[] iv = Base64.decode(encodedIv, Base64.NO_WRAP);
        byte[] ciphertext = Base64.decode(encodedCiphertext, Base64.NO_WRAP);
        if (iv.length != GCM_IV_BYTES || ciphertext.length < GCM_TAG_BYTES ||
                ciphertext.length > MAX_PROFILE_BYTES + GCM_TAG_BYTES)
            throw new IllegalStateException("Saved profile data has invalid dimensions.");
        Cipher cipher = Cipher.getInstance(CIPHER);
        cipher.init(Cipher.DECRYPT_MODE, getExistingKey(), new GCMParameterSpec(128, iv));
        byte[] plaintext = cipher.doFinal(ciphertext); // GCM authenticates before returning data.
        if (plaintext.length > MAX_PROFILE_BYTES)
            throw new IllegalStateException("Decrypted profile exceeds the size limit.");
        return new String(plaintext, StandardCharsets.UTF_8);
    }

    private SecretKey getExistingKey() throws Exception {
        if (!keyStore.containsAlias(KEY_ALIAS))
            throw new IllegalStateException("Profile encryption key is missing; re-import the profile.");
        return (SecretKey) keyStore.getKey(KEY_ALIAS, null);
    }

    private SecretKey getOrCreateKey() throws Exception {
        if (keyStore.containsAlias(KEY_ALIAS))
            return (SecretKey) keyStore.getKey(KEY_ALIAS, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build());
        return generator.generateKey();
    }
}
