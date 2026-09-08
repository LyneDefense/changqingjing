FROM maven:3.9.9-eclipse-temurin-18 AS build
WORKDIR /workspace
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN ./mvnw -B -DskipTests dependency:go-offline
COPY src src
RUN ./mvnw -B package

FROM eclipse-temurin:18-jre-jammy
WORKDIR /app
RUN useradd --system --uid 10001 --create-home appuser
COPY --from=build /workspace/target/backend-*.jar /app/backend.jar
USER appuser
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/backend.jar"]
