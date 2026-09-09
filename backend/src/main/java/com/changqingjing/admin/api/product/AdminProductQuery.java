package com.changqingjing.admin.api.product;

import com.changqingjing.common.api.PageQuery;
import com.changqingjing.content.CatalogPublicationStatus;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public class AdminProductQuery extends PageQuery {

    @Size(max = 100) private String keyword;
    private CatalogPublicationStatus status;
    private UUID categoryId;

    public String getKeyword() {
        return keyword;
    }

    public void setKeyword(String keyword) {
        this.keyword = keyword;
    }

    public CatalogPublicationStatus getStatus() {
        return status;
    }

    public void setStatus(CatalogPublicationStatus status) {
        this.status = status;
    }

    public UUID getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(UUID categoryId) {
        this.categoryId = categoryId;
    }
}
