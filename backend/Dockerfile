FROM eclipse-temurin:18-jdk-jammy AS build
WORKDIR /workspace
COPY . .
RUN ./mvnw -B -DskipTests package

FROM eclipse-temurin:18-jre-jammy
WORKDIR /app
RUN useradd --system --uid 10001 --create-home appuser
COPY --from=build /workspace/target/backend-*.jar /app/backend.jar
USER appuser
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/backend.jar"]
