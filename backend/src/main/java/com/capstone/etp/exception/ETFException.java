package com.capstone.etp.exception;

public abstract class ETFException extends RuntimeException {

    private final String catalogueCode;

    public ETFException(String catalogueCode, String catalogueMessage) {
        super(catalogueMessage);
        this.catalogueCode = catalogueCode;
    }

    public String getCatalogueCode() {
        return catalogueCode;
    }
}