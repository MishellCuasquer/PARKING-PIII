package ec.edu.espe.usuarios.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Date;
import java.util.List;

@Component
public class JwtConfig {

    @Value("${jwt.secret:miClaveSecretaSuperSeguraParaJWT123456789}")
    private String secret;

    @Value("${jwt.expiration:86400000}")
    private Long expiration;

    @Value("${jwt.issuer:http://localhost:8080}")
    private String issuer;

    private SecretKey getSigningKey() {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    public String generateToken(String username, String userId, List<String> roles, String tenantId) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + expiration);

        var builder = Jwts.builder()
                .issuer(issuer)
                .subject(username)
                .claim("userId", userId)
                .claim("roles", roles);

        // superadmin y la cuenta service no tienen tenant: el claim se omite
        if (tenantId != null) {
            builder.claim("tenantId", tenantId);
        }

        return builder
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(getSigningKey())
                .compact();
    }

    public Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public String getUsernameFromToken(String token) {
        return parseClaims(token).getSubject();
    }

    public String getUserIdFromToken(String token) {
        return parseClaims(token).get("userId", String.class);
    }

    public String getTenantIdFromToken(String token) {
        return parseClaims(token).get("tenantId", String.class);
    }

    @SuppressWarnings("unchecked")
    public List<String> getRolesFromToken(String token) {
        Object roles = parseClaims(token).get("roles");
        if (roles instanceof List<?> roleList) {
            return roleList.stream().map(Object::toString).toList();
        }
        return Collections.emptyList();
    }

    public long getExpirationEpochMs(String token) {
        return parseClaims(token).getExpiration().getTime();
    }

    public boolean validateToken(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public Long getExpirationTime() {
        return expiration;
    }

    public String getIssuer() {
        return issuer;
    }

    public String getSecret() {
        return secret;
    }
}
