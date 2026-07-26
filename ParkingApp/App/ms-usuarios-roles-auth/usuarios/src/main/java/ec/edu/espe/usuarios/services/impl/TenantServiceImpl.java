package ec.edu.espe.usuarios.services.impl;

import ec.edu.espe.usuarios.audit.AuditPublisher;
import ec.edu.espe.usuarios.dto.request.TenantRequest;
import ec.edu.espe.usuarios.dto.response.TenantResponse;
import ec.edu.espe.usuarios.entity.Tenant;
import ec.edu.espe.usuarios.repository.TenantRepository;
import ec.edu.espe.usuarios.services.TenantService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@Transactional
@RequiredArgsConstructor
public class TenantServiceImpl implements TenantService {

    // Valores por defecto de la configuración de una empresa. Se aplican tanto
    // al crear una empresa sin configuración explícita como al leer una empresa
    // antigua, anterior a que estas columnas existieran (ahí están a NULL).
    private static final BigDecimal TARIFA_HORA_DEFECTO = new BigDecimal("1.00");
    private static final String MONEDA_DEFECTO = "USD";
    private static final LocalTime APERTURA_DEFECTO = LocalTime.of(0, 0);
    private static final LocalTime CIERRE_DEFECTO = LocalTime.of(23, 59);

    private final TenantRepository tenantRepository;
    private final AuditPublisher auditPublisher;

    @Override
    public TenantResponse create(TenantRequest request) {
        String codigo = request.getCodigo().toUpperCase();
        if (tenantRepository.existsByCodigo(codigo)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El código de tenant ya existe");
        }
        if (tenantRepository.existsByNombre(request.getNombre())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El nombre de tenant ya existe");
        }

        Tenant tenant = Tenant.builder()
                .nombre(request.getNombre())
                .codigo(codigo)
                .activo(request.getActivo() == null || request.getActivo())
                .tarifaHora(request.getTarifaHora() != null ? request.getTarifaHora() : TARIFA_HORA_DEFECTO)
                .moneda(request.getMoneda() != null ? request.getMoneda() : MONEDA_DEFECTO)
                .horaApertura(request.getHoraApertura() != null ? request.getHoraApertura() : APERTURA_DEFECTO)
                .horaCierre(request.getHoraCierre() != null ? request.getHoraCierre() : CIERRE_DEFECTO)
                .build();
        tenant = tenantRepository.save(tenant);

        auditPublisher.publish("CREATE", "Tenant", Map.of(
                "id", tenant.getId(),
                "nombre", tenant.getNombre(),
                "codigo", tenant.getCodigo()
        ));

        return toResponse(tenant);
    }

    @Override
    @Transactional(readOnly = true)
    public List<TenantResponse> getAll() {
        return tenantRepository.findAll().stream().map(this::toResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<TenantResponse> getPublicos() {
        return tenantRepository.findByActivoTrue().stream().map(this::toResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public TenantResponse getById(UUID id) {
        return toResponse(loadTenant(id));
    }

    @Override
    public TenantResponse update(UUID id, TenantRequest request) {
        Tenant tenant = loadTenant(id);
        String codigo = request.getCodigo().toUpperCase();

        tenantRepository.findByCodigo(codigo)
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "El código de tenant ya existe");
                });

        tenant.setNombre(request.getNombre());
        tenant.setCodigo(codigo);
        if (request.getActivo() != null) {
            tenant.setActivo(request.getActivo());
        }

        // Configuración: solo se toca lo que venga informado. Así el formulario
        // de renombrar la empresa no borra su tarifa ni su horario.
        if (request.getTarifaHora() != null) {
            tenant.setTarifaHora(request.getTarifaHora());
        }
        if (request.getMoneda() != null) {
            tenant.setMoneda(request.getMoneda());
        }
        if (request.getHoraApertura() != null) {
            tenant.setHoraApertura(request.getHoraApertura());
        }
        if (request.getHoraCierre() != null) {
            tenant.setHoraCierre(request.getHoraCierre());
        }

        tenant = tenantRepository.save(tenant);

        auditPublisher.publish("UPDATE", "Tenant", Map.of(
                "id", tenant.getId(),
                "nombre", tenant.getNombre()
        ));

        return toResponse(tenant);
    }

    // Soft delete: hay Persons apuntando al tenant, no se elimina la fila
    @Override
    public void delete(UUID id) {
        Tenant tenant = loadTenant(id);
        tenant.setActivo(false);
        tenantRepository.save(tenant);

        auditPublisher.publish("DELETE", "Tenant", Map.of(
                "id", tenant.getId(),
                "nombre", tenant.getNombre()
        ));
    }

    private Tenant loadTenant(UUID id) {
        return tenantRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant no encontrado"));
    }

    private TenantResponse toResponse(Tenant tenant) {
        return TenantResponse.builder()
                .id(tenant.getId())
                .nombre(tenant.getNombre())
                .codigo(tenant.getCodigo())
                .activo(tenant.getActivo())
                // Los null solo aparecen en empresas creadas antes de que
                // existiera la configuración por tenant; se les da el defecto
                // para que ningún consumidor tenga que tratar el caso nulo.
                .tarifaHora(tenant.getTarifaHora() != null ? tenant.getTarifaHora() : TARIFA_HORA_DEFECTO)
                .moneda(tenant.getMoneda() != null ? tenant.getMoneda() : MONEDA_DEFECTO)
                .horaApertura(tenant.getHoraApertura() != null ? tenant.getHoraApertura() : APERTURA_DEFECTO)
                .horaCierre(tenant.getHoraCierre() != null ? tenant.getHoraCierre() : CIERRE_DEFECTO)
                .createdAt(tenant.getCreatedAt())
                .updatedAt(tenant.getUpdatedAt())
                .build();
    }
}
