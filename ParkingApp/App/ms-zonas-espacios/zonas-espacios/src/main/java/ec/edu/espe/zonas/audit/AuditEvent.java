package ec.edu.espe.zonas.audit;

import java.util.Map;

//NUEVO CAMBIO
public record AuditEvent(
        String servicio,
        String accion,
        String entidad,
        Map<String, Object> datos,
        String usuario,
        String ip,
        String mac
) {
//****
    // // Prueba de actualización para activar GitHub Actions
}
