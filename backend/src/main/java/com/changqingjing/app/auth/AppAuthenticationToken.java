package com.changqingjing.app.auth;

import java.util.List;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

public final class AppAuthenticationToken extends AbstractAuthenticationToken {

    private static final String ROLE_APP_USER = "ROLE_APP_USER";

    private final AppPrincipal principal;

    public AppAuthenticationToken(AppPrincipal principal) {
        super(List.of(new SimpleGrantedAuthority(ROLE_APP_USER)));
        this.principal = principal;
        setAuthenticated(true);
    }

    @Override
    public Object getCredentials() {
        return "";
    }

    @Override
    public AppPrincipal getPrincipal() {
        return principal;
    }
}
