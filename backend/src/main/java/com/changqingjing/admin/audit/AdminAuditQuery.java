package com.changqingjing.admin.audit;

import com.changqingjing.common.api.PageQuery;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;

public class AdminAuditQuery extends PageQuery {
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) private LocalDate from;
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) private LocalDate to;
    @Size(max = 100) private String actor;
    @Size(max = 100) private String keyword;
    @Pattern(regexp = "AUTH|STAFF|USERS|HOME_HERO|HOME_VIDEO|PRODUCT|MAP|COMPANY|COOPERATION|SCENIC|MEDIA|OTHER|^$")
    private String module;
    @Pattern(regexp = "DRAFT_SAVE|PUBLISH|UNPUBLISH|PREVIEW|DELETE|LOGIN|LOGOUT|CREATE|UPDATE|PASSWORD_RESET|UPLOAD|^$")
    private String action;
    @Pattern(regexp = "SUCCESS|FAILURE|^$") private String result;
    public LocalDate getFrom() { return from; } public void setFrom(LocalDate value) { from = value; }
    public LocalDate getTo() { return to; } public void setTo(LocalDate value) { to = value; }
    public String getActor() { return actor; } public void setActor(String value) { actor = value; }
    public String getKeyword() { return keyword; } public void setKeyword(String value) { keyword = value; }
    public String getModule() { return module; } public void setModule(String value) { module = value; }
    public String getAction() { return action; } public void setAction(String value) { action = value; }
    public String getResult() { return result; } public void setResult(String value) { result = value; }
}
