package com.tanmaysinghx.qubit.security;

import com.tanmaysinghx.qubit.config.QubitProperties;
import com.tanmaysinghx.qubit.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TokenService {

    private final JwtEncoder encoder;
    private final JwtDecoder decoder;
    private final QubitProperties props;

    public String issue(User user) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("qubit")
                .subject(String.valueOf(user.getId()))
                .issuedAt(now)
                .expiresAt(now.plus(props.jwt().ttlHours(), ChronoUnit.HOURS))
                .claim("email", user.getEmail())
                .claim("name", user.getFullName())
                .claim("roles", List.of(user.getRole().name()))
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    /** Decodes and validates a token; throws {@link JwtException} when invalid. */
    public Jwt decode(String token) {
        return decoder.decode(token);
    }
}
