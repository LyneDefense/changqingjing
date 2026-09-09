package com.changqingjing.admin.api.content;

import com.changqingjing.common.api.PageQuery;
import com.changqingjing.content.HomeVideoStatus;
import jakarta.validation.constraints.Size;

public class AdminHomeVideoQuery extends PageQuery {

    @Size(max = 100)
    private String keyword = "";

    private HomeVideoStatus status;

    public String getKeyword() {
        return keyword;
    }

    public void setKeyword(String keyword) {
        this.keyword = keyword;
    }

    public HomeVideoStatus getStatus() {
        return status;
    }

    public void setStatus(HomeVideoStatus status) {
        this.status = status;
    }
}
