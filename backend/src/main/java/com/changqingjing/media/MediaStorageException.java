package com.changqingjing.media;

public class MediaStorageException extends RuntimeException {

    private final String code;

    public MediaStorageException(String code, String message) {
        super(message);
        this.code = code;
    }

    public MediaStorageException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
