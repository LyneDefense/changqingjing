package com.changqingjing.admin.api.staff;

import com.changqingjing.admin.auth.AdminStatus;
import com.changqingjing.common.api.PageQuery;
import jakarta.validation.constraints.Size;

public class AdminStaffQuery extends PageQuery {

    @Size(max = 100)
    private String keyword = "";

    private AdminStatus status;

    public String getKeyword() {
        return keyword;
    }

    public void setKeyword(String keyword) {
        this.keyword = keyword;
    }

    public AdminStatus getStatus() {
        return status;
    }

    public void setStatus(AdminStatus status) {
        this.status = status;
    }
}
