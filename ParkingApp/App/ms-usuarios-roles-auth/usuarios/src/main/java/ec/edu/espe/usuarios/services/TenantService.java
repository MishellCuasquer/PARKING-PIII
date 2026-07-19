package ec.edu.espe.usuarios.services;

import ec.edu.espe.usuarios.dto.request.TenantRequest;
import ec.edu.espe.usuarios.dto.response.TenantResponse;

import java.util.List;
import java.util.UUID;

public interface TenantService {

    TenantResponse create(TenantRequest request);

    List<TenantResponse> getAll();

    List<TenantResponse> getPublicos();

    TenantResponse getById(UUID id);

    TenantResponse update(UUID id, TenantRequest request);

    void delete(UUID id);
}
