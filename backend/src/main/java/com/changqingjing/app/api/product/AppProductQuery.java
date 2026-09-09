package com.changqingjing.app.api.product;

import com.changqingjing.common.api.PageQuery;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public class AppProductQuery extends PageQuery {

    @Size(max = 100, message = "搜索词不能超过 100 个字符")
    private String keyword;
    private UUID categoryId;

    public String getKeyword() {
        return keyword;
    }

    public void setKeyword(String keyword) {
        this.keyword = keyword;
    }

    public UUID getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(UUID categoryId) {
        this.categoryId = categoryId;
    }
}
