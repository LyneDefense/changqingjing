package com.changqingjing.admin.dashboard;

import com.changqingjing.admin.audit.AdminAuditQuery;
import com.changqingjing.admin.audit.AdminAuditQueryService;
import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.admin.auth.AdminRole;
import com.changqingjing.app.user.AppUserRepository;
import com.changqingjing.app.user.AppUserView;
import com.changqingjing.common.api.BusinessException;
import com.changqingjing.media.MediaService;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminDashboardService {
    private static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");
    private final JdbcTemplate jdbc;
    private final AppUserRepository users;
    private final MediaService media;
    private final AdminAuditQueryService audits;
    private final Clock clock;

    @Autowired
    public AdminDashboardService(JdbcTemplate jdbc, AppUserRepository users, MediaService media, AdminAuditQueryService audits) {
        this(jdbc, users, media, audits, Clock.systemUTC());
    }
    AdminDashboardService(JdbcTemplate jdbc, AppUserRepository users, MediaService media, AdminAuditQueryService audits, Clock clock) {
        this.jdbc = jdbc; this.users = users; this.media = media; this.audits = audits; this.clock = clock;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public AdminDashboardResponse get(AdminPrincipal actor, int days) {
        if (actor == null) throw new BusinessException(HttpStatus.UNAUTHORIZED, "AUTH_REQUIRED", "请先登录");
        if (days != 7 && days != 30) throw new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_TREND_DAYS", "趋势仅支持 7 天或 30 天");
        OffsetDateTime now = OffsetDateTime.ofInstant(clock.instant(), ZONE);
        var auditQuery = new AdminAuditQuery();
        auditQuery.setPageSize(6);
        var recent = audits.search(actor, auditQuery).items();
        if (actor.role() != AdminRole.ADMIN)
            return new AdminDashboardResponse(false, null, List.of(), List.of(), recent, days, now, ZONE.getId());

        LocalDate today = now.toLocalDate();
        OffsetDateTime start = today.atStartOfDay(ZONE).toOffsetDateTime();
        OffsetDateTime end = today.plusDays(1).atStartOfDay(ZONE).toOffsetDateTime();
        OffsetDateTime sevenStart = today.minusDays(6).atStartOfDay(ZONE).toOffsetDateTime();
        var statistics = jdbc.queryForObject("""
            SELECT count(*) AS total,
                count(*) FILTER (WHERE registered_at >= ? AND registered_at < ?) AS today,
                count(*) FILTER (WHERE registered_at >= ? AND registered_at < ?) AS seven,
                count(*) FILTER (WHERE deleted_at IS NULL AND status = 'DISABLED') AS frozen
            FROM app_user
            """, (rs, index) -> new AdminDashboardResponse.Statistics(rs.getLong("total"), rs.getLong("today"),
                rs.getLong("seven"), rs.getLong("frozen")), start, end, sevenStart, end);
        LocalDate first = today.minusDays(days - 1L);
        Map<LocalDate, Long> counts = jdbc.query("""
            SELECT (registered_at AT TIME ZONE 'Asia/Shanghai')::date AS date, count(*) AS count
            FROM app_user WHERE registered_at >= ? AND registered_at < ? GROUP BY 1 ORDER BY 1
            """, (rs, index) -> new AdminDashboardResponse.DailyRegistration(rs.getObject("date", LocalDate.class), rs.getLong("count")),
                first.atStartOfDay(ZONE).toOffsetDateTime(), end).stream()
                .collect(Collectors.toMap(AdminDashboardResponse.DailyRegistration::date, AdminDashboardResponse.DailyRegistration::count));
        List<AdminDashboardResponse.DailyRegistration> trend = new ArrayList<>();
        for (int index = 0; index < days; index++) {
            LocalDate date = first.plusDays(index);
            trend.add(new AdminDashboardResponse.DailyRegistration(date, counts.getOrDefault(date, 0L)));
        }
        var recentUsers = users.search(null, null, null, 10, 0).stream().map(this::recentUser).toList();
        return new AdminDashboardResponse(true, statistics, List.copyOf(trend), recentUsers, recent, days, now, ZONE.getId());
    }

    private AdminDashboardResponse.RecentUser recentUser(AppUserView user) {
        String avatar = null;
        if (user.avatarMediaId() != null) {
            try { avatar = media.signReadyMedia(user.avatarMediaId()).url(); }
            catch (BusinessException ignored) { /* A missing/unavailable avatar must not hide the registration statistics. */ }
        }
        return new AdminDashboardResponse.RecentUser(user.id(), user.displayName(), user.maskedPhone(), avatar,
                user.status().name(), user.registeredAt());
    }
}
