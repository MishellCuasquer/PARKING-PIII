package ec.edu.espe.zonas.controladores;

import ec.edu.espe.zonas.dto.request.EspacioRequestDto;
import ec.edu.espe.zonas.dto.response.EspacioResponseDto;
import ec.edu.espe.zonas.entidades.EstadoEspacio;
import ec.edu.espe.zonas.servicios.interfaz.EspacioServicio;
import ec.edu.espe.zonas.sse.EspacioEventos;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/espacios")
@RequiredArgsConstructor
public class EspacioControlador {

    private final EspacioServicio espacioServicio;
    private final EspacioEventos espacioEventos;

    /**
     * Obtiene el estado general de todos los espacios del parqueadero
     * GET /api/espacios
     */
    @GetMapping
    public ResponseEntity<List<EspacioResponseDto>> obtenerEspacios() {
        return ResponseEntity.ok(espacioServicio.obtenerEspacios());
    }

    /**
     * Stream SSE con los cambios de estado de espacios en tiempo real.
     * Público (igual que el GET de lista); cada evento trae idTenant para
     * que el cliente filtre su empresa.
     * X-Accel-Buffering: no → Kong/nginx no bufferizan y los eventos llegan al instante.
     * GET /api/espacios/stream
     */
    @GetMapping("/stream")
    public ResponseEntity<SseEmitter> stream() {
        return ResponseEntity.ok()
                .header("X-Accel-Buffering", "no")
                .header("Cache-Control", "no-cache")
                .body(espacioEventos.suscribir());
    }

    /**
     * Obtiene espacios filtrados por estado
     * GET /api/espacios/por-estado/{estado}
     * Ejemplo: GET /api/espacios/por-estado/DISPONIBLE
     */
    @GetMapping("/por-estado/{estado}")
    public ResponseEntity<List<EspacioResponseDto>> obtenerEspaciosPorEstado(@PathVariable String estado) {
        return ResponseEntity.ok(espacioServicio.obtenerEspaciosPorEstado(estado));
    }

    /**
     * Obtiene espacios de una zona específica con un estado determinado
     * GET /api/espacios/zona/{idZona}/estado/{estado}
     */
    @GetMapping("/zona/{idZona}/estado/{estado}")
    public ResponseEntity<List<EspacioResponseDto>> obtenerEspaciosPorZonaEstado(
            @PathVariable UUID idZona,
            @PathVariable String estado) {
        return ResponseEntity.ok(espacioServicio.obtenerEspaciosPorZonaEstado(idZona, estado));
    }

    /**
     * Obtiene espacios agrupados por zona según su estado
     * GET /api/espacios/agrupados/estado/{estado}
     */
    @GetMapping("/agrupados/estado/{estado}")
    public ResponseEntity<Map<String, List<EspacioResponseDto>>> espaciosPorEstadoAgrupadosPorZona(
            @PathVariable String estado) {
        return ResponseEntity.ok(espacioServicio.espaciosPorEstadoAgrupadosPorZona(estado));
    }

    /**
     * Obtiene un espacio específico por ID
     * GET /api/espacios/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<EspacioResponseDto> obtenerEspacio(@PathVariable UUID id) {
        return ResponseEntity.ok(espacioServicio.obtenerEspacio(id));
    }

    /**
     * Crea un nuevo espacio en una zona
     * POST /api/espacios
     * Body: { "descripcion": "...", "tipo": "REGULAR", "idZona": "uuid" }
     */
    @PostMapping
    public ResponseEntity<EspacioResponseDto> crearEspacio(@Valid @RequestBody EspacioRequestDto requestDto) {
        EspacioResponseDto responseDto = espacioServicio.crearEspacio(requestDto);
        return new ResponseEntity<>(responseDto, HttpStatus.CREATED);
    }

    /**
     * Actualiza un espacio existente
     * PUT /api/espacios/{id}
     */
    @PutMapping("/{id}")
    public ResponseEntity<EspacioResponseDto> actualizarEspacio(
            @PathVariable UUID id,
            @Valid @RequestBody EspacioRequestDto requestDto) {
        EspacioResponseDto responseDto = espacioServicio.actualizarEspacio(requestDto);
        return ResponseEntity.ok(responseDto);
    }

    /**
     * Elimina un espacio (borrado físico)
     * DELETE /api/espacios/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminarEspacio(@PathVariable String id) {
        espacioServicio.eliminarEspacio(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Cambia el estado de un espacio (DISPONIBLE a OCUPADO, etc.)
     * PUT /api/espacios/{id}/estado
     * Body: { "estado": "OCUPADO" }
     */
    @PutMapping("/{id}/estado")
    public ResponseEntity<EspacioResponseDto> cambiarEstado(
            @PathVariable UUID id,
            @RequestParam EstadoEspacio estado) {
        EspacioResponseDto responseDto = espacioServicio.cambiarEstado(id, estado);
        return ResponseEntity.ok(responseDto);
    }

    /**
     * Reserva un espacio disponible
     * PUT /api/espacios/{id}/reservar
     */
    @PutMapping("/{id}/reservar")
    public ResponseEntity<EspacioResponseDto> reservarEspacio(@PathVariable UUID id) {
        EspacioResponseDto responseDto = espacioServicio.reservarEspacio(id);
        return ResponseEntity.ok(responseDto);
    }
}

