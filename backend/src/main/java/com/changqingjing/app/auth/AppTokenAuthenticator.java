package com.changqingjing.app.auth;

import java.util.Optional;

@FunctionalInterface
public interface AppTokenAuthenticator {

    Optional<AppPrincipal> authenticate(String rawToken);
}
