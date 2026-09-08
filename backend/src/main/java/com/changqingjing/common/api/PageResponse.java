package com.changqingjing.common.api;

import java.util.List;

public record PageResponse<T>(List<T> items, int page, int pageSize, long total) {

    public PageResponse {
        items = List.copyOf(items);
        if (page < 1 || pageSize < 1 || pageSize > 100 || total < 0) {
            throw new IllegalArgumentException("Invalid page response metadata");
        }
    }

    public static <T> PageResponse<T> of(List<T> items, PageQuery query, long total) {
        return new PageResponse<>(items, query.getPage(), query.getPageSize(), total);
    }
}
