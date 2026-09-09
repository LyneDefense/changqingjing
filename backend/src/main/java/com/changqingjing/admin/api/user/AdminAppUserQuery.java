package com.changqingjing.admin.api.user;

import com.changqingjing.app.user.AppUserStatus;
import com.changqingjing.common.api.PageQuery;
import jakarta.validation.constraints.Size;

public class AdminAppUserQuery extends PageQuery {

    @Size(max = 100, message = "搜索词不能超过 100 个字符")
    private String keyword;
    private AppUserStatus status;
    private Boolean phoneBound;

    public String getKeyword() {
        return keyword;
    }

    public void setKeyword(String keyword) {
        this.keyword = keyword;
    }

    public AppUserStatus getStatus() {
        return status;
    }

    public void setStatus(AppUserStatus status) {
        this.status = status;
    }

    public Boolean getPhoneBound() {
        return phoneBound;
    }

    public void setPhoneBound(Boolean phoneBound) {
        this.phoneBound = phoneBound;
    }
}
