# syntax=docker/dockerfile:1
# Build stage
FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
# Cache de BuildKit para el repositorio local de Maven: sin esto, CADA build
# descarga todas las dependencias desde cero (varios minutos en un entorno con
# CPU/red limitados como un clúster local). El cache persiste entre builds
# aunque cambie el código fuente.
RUN --mount=type=cache,target=/root/.m2 mvn clean package -DskipTests

# Runtime stage
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S spring && adduser -S spring -G spring
COPY --from=build /app/target/*.jar app.jar
USER spring
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
