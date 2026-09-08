package com.changqingjing.common.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ApiTraceFilter extends OncePerRequestFilter {

    public static final String HEADER_NAME = "X-Trace-Id";
    public static final String REQUEST_ATTRIBUTE = ApiTraceFilter.class.getName() + ".traceId";
    public static final String MDC_KEY = "traceId";

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        String traceId = UUID.randomUUID().toString();
        request.setAttribute(REQUEST_ATTRIBUTE, traceId);
        response.setHeader(HEADER_NAME, traceId);

        try (MDC.MDCCloseable ignored = MDC.putCloseable(MDC_KEY, traceId)) {
            filterChain.doFilter(request, response);
        }
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/v1/");
    }

    public static String currentTraceId(HttpServletRequest request) {
        Object traceId = request.getAttribute(REQUEST_ATTRIBUTE);
        return traceId instanceof String value ? value : UUID.randomUUID().toString();
    }
}
