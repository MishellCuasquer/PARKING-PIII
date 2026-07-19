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

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@Transactional
@RequiredArgsConstructor
public class TenantServiceImpl implements TenantService {

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
                .createdAt(tenant.getCreatedAt())
                .updatedAt(tenant.getUpdatedAt())
                .build();
    }
}
