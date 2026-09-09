package com.changqingjing.common.web;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class ApiRateLimitFilterTest {

    private static final Clock FIXED_CLOCK = Clock.fixed(
            Instant.parse("2026-09-09T12:00:20Z"), ZoneOffset.UTC);

    @Test
    void rejectsRequestsPastTheConfiguredLimitWithAStableApiError() throws Exception {
        ApiRateLimitFilter filter = filter(2);

        MockHttpServletResponse first = perform(filter, "10.0.0.1");
        MockHttpServletResponse second = perform(filter, "10.0.0.1");
        MockHttpServletResponse blocked = perform(filter, "10.0.0.1");
        MockHttpServletResponse otherAddress = perform(filter, "10.0.0.2");

        assertThat(first.getStatus()).isEqualTo(200);
        assertThat(second.getHeader("X-RateLimit-Remaining")).isEqualTo("0");
        assertThat(blocked.getStatus()).isEqualTo(429);
        assertThat(blocked.getHeader("Retry-After")).isEqualTo("40");
        assertThat(blocked.getContentAsString()).contains("\"code\":\"RATE_LIMITED\"");
        assertThat(otherAddress.getStatus()).isEqualTo(200);
    }

    @Test
    void enforcesTheLimitAtomicallyForConcurrentRequests() throws Exception {
        int limit = 12;
        int attempts = 48;
        ApiRateLimitFilter filter = filter(limit);
        AtomicInteger allowed = new AtomicInteger();
        AtomicInteger blocked = new AtomicInteger();
        CountDownLatch ready = new CountDownLatch(attempts);
        CountDownLatch start = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(attempts);
        List<java.util.concurrent.Future<?>> futures = new ArrayList<>();

        for (int index = 0; index < attempts; index++) {
            futures.add(executor.submit(() -> {
                ready.countDown();
                start.await();
                int status = perform(filter, "10.0.0.8").getStatus();
                if (status == 429) {
                    blocked.incrementAndGet();
                } else {
                    allowed.incrementAndGet();
                }
                return null;
            }));
        }
        assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
        start.countDown();
        for (var future : futures) {
            future.get(5, TimeUnit.SECONDS);
        }
        executor.shutdownNow();

        assertThat(allowed).hasValue(limit);
        assertThat(blocked).hasValue(attempts - limit);
    }

    private ApiRateLimitFilter filter(int limit) {
        return new ApiRateLimitFilter(
                new ObjectMapper(), FIXED_CLOCK, limit, limit, limit, limit);
    }

    private MockHttpServletResponse perform(ApiRateLimitFilter filter, String remoteAddress)
            throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(
                "POST", "/api/v1/app/auth/wechat/session");
        request.setRemoteAddr(remoteAddress);
        request.setAttribute(ApiTraceFilter.REQUEST_ATTRIBUTE, "rate-limit-test-trace");
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }
}
