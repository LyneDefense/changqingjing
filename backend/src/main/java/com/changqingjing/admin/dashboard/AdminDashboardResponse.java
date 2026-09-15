package com.changqingjing.admin.dashboard;

import com.changqingjing.admin.audit.AdminAuditResponse;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record AdminDashboardResponse(boolean userMetricsVisible, Statistics statistics,
        List<DailyRegistration> registrationTrend, List<RecentUser> recentUsers,
        List<AdminAuditResponse> recentOperations, int trendDays, OffsetDateTime generatedAt, String timezone) {
    public record Statistics(long totalRegistrations, long todayRegistrations, long last7DaysRegistrations, long frozenUsers) {}
    public record DailyRegistration(LocalDate date, long count) {}
    public record RecentUser(UUID id, String displayName, String maskedPhone, String avatarUrl,
            String status, OffsetDateTime registeredAt) {}
}
