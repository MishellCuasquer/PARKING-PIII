package ec.edu.espe.zonas.controladores;


import ec.edu.espe.zonas.dto.request.ZonaRequestDto;
import ec.edu.espe.zonas.dto.response.ZonaResponseDto;
import ec.edu.espe.zonas.servicios.interfaz.ZonaServicio;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/zonas")
@RequiredArgsConstructor

public class ZonaControlador {

    private final ZonaServicio servicioZonas;


    @GetMapping
    public ResponseEntity<List<ZonaResponseDto>> listarZonas() {
        return ResponseEntity.ok(servicioZonas.listarZonas());

    }
    @PostMapping
    public ResponseEntity<ZonaResponseDto>crearZona(@Valid @RequestBody ZonaRequestDto dto) {
        ZonaResponseDto responseDto = servicioZonas.crearZona(dto);
        return new ResponseEntity<>(responseDto, HttpStatus.CREATED);
    }


    @PutMapping("/{idZona}")
    public ResponseEntity<ZonaResponseDto> actualizarZona(@PathVariable UUID idZona, @Valid @RequestBody ZonaRequestDto dto) {
    return ResponseEntity.ok(servicioZonas.actualizarZona(idZona, dto));
    }

    @DeleteMapping("/{idZona}")
    public ResponseEntity<Void> eliminarZona(@PathVariable UUID idZona) {
        servicioZonas.eliminarZona(idZona);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{idZona}/init-espacios")
    public ResponseEntity<Void> inicializarEspacios(@PathVariable UUID idZona) {
        servicioZonas.inicializarEspacios(idZona);
        return ResponseEntity.accepted().build();
    }

}
