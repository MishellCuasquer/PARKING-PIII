package ec.edu.espe.usuarios.repository;

import ec.edu.espe.usuarios.entity.Person;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PersonRepository extends JpaRepository<Person, UUID> {

    boolean existsByEmail(String email);

    boolean existsByDni(String dni);

    Optional<Person> findByDni(String dni);

    Optional<Person> findByEmail(String email);

    Optional<Person> findByPhone(String phone);

    // Variantes por tenant: la unicidad de dni/email/phone es por parqueadero
    boolean existsByEmailAndTenant_Id(String email, UUID tenantId);

    boolean existsByDniAndTenant_Id(String dni, UUID tenantId);

    Optional<Person> findByDniAndTenant_Id(String dni, UUID tenantId);

    Optional<Person> findByEmailAndTenant_Id(String email, UUID tenantId);

    Optional<Person> findByPhoneAndTenant_Id(String phone, UUID tenantId);

    List<Person> findByTenant_Id(UUID tenantId);

    // Mismo dueño en varias empresas: el email se repite entre tenants
    List<Person> findAllByEmail(String email);
}
