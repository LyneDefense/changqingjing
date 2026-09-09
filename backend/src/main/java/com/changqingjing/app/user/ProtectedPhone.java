package com.changqingjing.app.user;

public record ProtectedPhone(byte[] ciphertext, byte[] queryDigest, String maskedPhone) {

    public ProtectedPhone {
        ciphertext = ciphertext.clone();
        queryDigest = queryDigest.clone();
    }

    @Override
    public byte[] ciphertext() {
        return ciphertext.clone();
    }

    @Override
    public byte[] queryDigest() {
        return queryDigest.clone();
    }
}
