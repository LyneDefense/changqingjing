package com.changqingjing.admin.audit;

import java.util.UUID;

/** A whitelist of submitted business operations; never reads request bodies or query secrets. */
public record AdminAuditOperation(String action, String targetType, UUID targetId, String kind) {

    public static AdminAuditOperation resolve(String method, String uri) {
        String path = uri.replaceFirst("^/api/v1/admin/", "");
        String[] parts = path.split("/");
        if (path.equals("auth/login") && method.equals("POST"))
            return new AdminAuditOperation("ADMIN_LOGIN", "ADMIN_ACCOUNT", null, null);
        if (path.equals("auth/logout") && method.equals("POST"))
            return new AdminAuditOperation("ADMIN_LOGOUT", "ADMIN_ACCOUNT", null, null);
        if (path.equals("map-selections") && method.equals("POST"))
            return new AdminAuditOperation("MAP_SELECTION_CREATE", "MAP_SELECTION", null, null);
        if (path.equals("media/uploads") && method.equals("POST"))
            return new AdminAuditOperation("MEDIA_UPLOAD_CREATE", "MEDIA_ASSET", null, null);
        if (parts.length == 4 && parts[0].equals("media") && parts[1].equals("uploads")
                && parts[3].equals("complete") && method.equals("POST") && uuid(parts[2]) != null)
            return new AdminAuditOperation("MEDIA_UPLOAD_VERIFY", "MEDIA_ASSET", uuid(parts[2]), null);
        if (parts[0].equals("staff")) {
            String action = parts.length == 1 && method.equals("POST") ? "ADMIN_STAFF_CREATE"
                    : parts.length == 2 && method.equals("PATCH") ? "ADMIN_STAFF_UPDATE"
                    : parts.length == 3 && parts[2].equals("reset-password") && method.equals("POST")
                        ? "ADMIN_STAFF_PASSWORD_RESET" : null;
            if (action != null && (parts.length == 1 || uuid(parts[1]) != null))
                return new AdminAuditOperation(action, "ADMIN_ACCOUNT", parts.length > 1 ? uuid(parts[1]) : null, null);
        }
        if (parts[0].equals("users") && parts.length >= 2 && uuid(parts[1]) != null) {
            if (parts.length == 2 && method.equals("DELETE"))
                return new AdminAuditOperation("APP_USER_DELETE", "APP_USER", uuid(parts[1]), null);
            if (parts.length == 3 && parts[2].equals("status") && method.equals("PATCH"))
                return new AdminAuditOperation("APP_USER_STATUS_UPDATE", "APP_USER", uuid(parts[1]), null);
        }
        int offset = parts[0].equals("contents") ? 1 : 0;
        if (parts.length <= offset) return null;
        String kind = switch (parts[offset]) {
            case "home-hero" -> "HOME_HERO";
            case "home-videos" -> "HOME_VIDEO";
            case "company" -> "COMPANY";
            case "cooperation" -> "COOPERATION";
            case "scenics" -> "SCENIC";
            case "products" -> "PRODUCT";
            case "product-categories" -> "PRODUCT_CATEGORY";
            default -> null;
        };
        if (kind == null) return null;
        boolean singleton = kind.equals("HOME_HERO") || kind.equals("COMPANY") || kind.equals("COOPERATION");
        UUID id = !singleton && parts.length > offset + 1 ? uuid(parts[offset + 1]) : null;
        int suffixIndex = offset + (singleton ? 1 : 2);
        String suffix = parts.length == suffixIndex + 1 ? parts[suffixIndex] : "";
        String verb = switch (suffix) {
            case "draft" -> method.equals("PUT") ? "DRAFT_SAVE" : null;
            case "publish" -> method.equals("POST") ? "PUBLISH" : null;
            case "unpublish" -> method.equals("POST") ? "UNPUBLISH" : null;
            case "preview" -> method.equals("GET") ? "PREVIEW" : null;
            default -> parts.length == offset + 1 && method.equals("POST") && !singleton ? "DRAFT_SAVE"
                    : parts.length == suffixIndex && method.equals("DELETE") && id != null ? "DELETE" : null;
        };
        if (verb == null || (!singleton && parts.length > offset + 1 && id == null)) return null;
        return new AdminAuditOperation(kind + "_" + verb, "CONTENT_ENTRY", id, kind);
    }

    private static UUID uuid(String value) {
        try { return UUID.fromString(value); } catch (IllegalArgumentException ignored) { return null; }
    }

    public static String module(String action) {
        if (action.startsWith("ADMIN_STAFF_")) return "STAFF";
        if (action.startsWith("ADMIN_")) return "AUTH";
        if (action.startsWith("APP_USER_")) return "USERS";
        if (action.startsWith("HOME_HERO_")) return "HOME_HERO";
        if (action.startsWith("HOME_VIDEO_")) return "HOME_VIDEO";
        if (action.startsWith("PRODUCT_")) return "PRODUCT";
        if (action.startsWith("MAP_")) return "MAP";
        for (String name : new String[]{"COMPANY", "COOPERATION", "SCENIC", "MEDIA"})
            if (action.startsWith(name + "_")) return name;
        return "OTHER";
    }

    public static String moduleLabel(String module) {
        return switch (module) {
            case "AUTH" -> "登录与会话"; case "STAFF" -> "后台人员"; case "USERS" -> "注册用户";
            case "HOME_HERO" -> "首页头图"; case "HOME_VIDEO" -> "宣传视频"; case "PRODUCT" -> "会员福利";
            case "MAP" -> "地图选点"; case "COMPANY" -> "公司介绍"; case "COOPERATION" -> "合作权益";
            case "SCENIC" -> "景区管理"; case "MEDIA" -> "媒体上传"; default -> "其他操作";
        };
    }

    public static String actionLabel(String action) {
        if (action.endsWith("DRAFT_SAVE")) return "保存草稿";
        if (action.endsWith("UNPUBLISH")) return "下架";
        if (action.endsWith("PUBLISH")) return "发布";
        if (action.endsWith("PREVIEW")) return "预览草稿";
        return switch (action) {
            case "ADMIN_LOGIN" -> "登录"; case "ADMIN_LOGOUT" -> "退出登录";
            case "ADMIN_BOOTSTRAP" -> "初始化管理员"; case "ADMIN_STAFF_CREATE" -> "新增人员";
            case "ADMIN_STAFF_UPDATE" -> "修改人员"; case "ADMIN_STAFF_PASSWORD_RESET" -> "重置密码";
            case "APP_USER_STATUS_UPDATE" -> "冻结 / 解冻用户"; case "APP_USER_DELETE" -> "删除用户";
            case "MEDIA_UPLOAD_CREATE" -> "申请上传"; case "MEDIA_UPLOAD_VERIFY" -> "完成上传校验";
            case "MAP_SELECTION_CREATE" -> "确认地图位置";
            default -> action.endsWith("DELETE") ? "删除内容" : action;
        };
    }

    public static boolean affectsOnline(String action) {
        return action.endsWith("PUBLISH") || action.equals("APP_USER_STATUS_UPDATE") || action.equals("APP_USER_DELETE");
    }
}
