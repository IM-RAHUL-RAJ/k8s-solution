FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /workspace

COPY pom.xml .
RUN mvn -q -DskipTests dependency:go-offline

COPY src src
RUN mvn -q -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

RUN addgroup --system spring && adduser --system --ingroup spring spring

RUN mkdir -p /app/logs \
    && chown -R spring:spring /app/logs

COPY --from=build /workspace/target/trade-executor-1.0.0-SNAPSHOT.jar app.jar

EXPOSE 8085
USER spring:spring
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD sh -c "curl --fail --silent http://127.0.0.1:${SERVER_PORT:-8085}/actuator/health"

ENTRYPOINT ["java","-jar","/app/app.jar"]

