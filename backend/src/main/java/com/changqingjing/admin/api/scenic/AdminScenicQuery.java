package com.changqingjing.admin.api.scenic;

import com.changqingjing.common.api.PageQuery;
import com.changqingjing.content.ScenicPublicationStatus;
import jakarta.validation.constraints.Size;

public class AdminScenicQuery extends PageQuery {

    @Size(max = 100)
    private String keyword = "";
    private ScenicPublicationStatus status;

    public String getKeyword() {
        return keyword;
    }

    public void setKeyword(String keyword) {
        this.keyword = keyword == null ? "" : keyword;
    }

    public ScenicPublicationStatus getStatus() {
        return status;
    }

    public void setStatus(ScenicPublicationStatus status) {
        this.status = status;
    }
}
