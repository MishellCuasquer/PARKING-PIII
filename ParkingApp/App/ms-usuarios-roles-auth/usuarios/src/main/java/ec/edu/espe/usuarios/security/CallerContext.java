package ec.edu.espe.usuarios.security;

import ec.edu.espe.usuarios.entity.Person;
import ec.edu.espe.usuarios.entity.Tenant;
import ec.edu.espe.usuarios.entity.User;
import ec.edu.espe.usuarios.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Resuelve el tenant del usuario autenticado a partir del SecurityContext.
 * Devuelve null para peticiones anónimas o cuentas globales (superadmin, service),
 * que por convención tienen visibilidad total.
 */
@Component
@RequiredArgsConstructor
public class CallerContext {

    private final UserRepository userRepository;

    public UUID callerTenantId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            return null;
        }
        return userRepository.findByUsernameWithRole(authentication.getName())
                .map(User::getPerson)
                .map(Person::getTenant)
                .map(Tenant::getId)
                .orElse(null);
    }
}
