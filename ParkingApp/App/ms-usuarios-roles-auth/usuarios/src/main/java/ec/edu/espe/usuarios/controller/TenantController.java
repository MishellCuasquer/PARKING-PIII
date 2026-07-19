package ec.edu.espe.usuarios.controller;

import ec.edu.espe.usuarios.dto.request.TenantRequest;
import ec.edu.espe.usuarios.dto.response.TenantResponse;
import ec.edu.espe.usuarios.services.TenantService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/tenants")
@RequiredArgsConstructor
public class TenantController {

    private final TenantService tenantService;

    // Público: alimenta el selector de empresa del registro (solo tenants activos)
    @GetMapping("/publicos")
    public ResponseEntity<List<TenantResponse>> getPublicos() {
        return ResponseEntity.ok(tenantService.getPublicos());
    }

    @GetMapping
    public ResponseEntity<List<TenantResponse>> getAll() {
        return ResponseEntity.ok(tenantService.getAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<TenantResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(tenantService.getById(id));
    }

    @PostMapping
    public ResponseEntity<TenantResponse> create(@Valid @RequestBody TenantRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(tenantService.create(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<TenantResponse> update(@PathVariable UUID id,
                                                 @Valid @RequestBody TenantRequest request) {
        return ResponseEntity.ok(tenantService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        tenantService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
