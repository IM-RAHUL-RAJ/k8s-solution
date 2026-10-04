package com.capstone.etp.service;

import com.capstone.etp.exception.RegistrationException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Talks to a small real HTTP server that behaves like the auth service (a Node server with
 * socket.io): a request that asks to upgrade the connection gets the connection closed with no
 * reply at all. The client has to speak plain HTTP/1.1 to get an answer.
 */
class AuthRegistrationClientTest {

    private ServerSocket server;
    private Thread acceptor;
    private volatile int status = 201;
    private volatile String body = "{\"emailSent\":true}";
    private final AtomicReference<String> lastRequest = new AtomicReference<>();

    @BeforeEach
    void startServer() throws IOException {
        server = new ServerSocket(0);
        acceptor = new Thread(() -> {
            while (!server.isClosed()) {
                try (Socket socket = server.accept()) {
                    handle(socket);
                } catch (IOException ignored) {
                    // closed while stopping, or a dropped connection
                }
            }
        });
        acceptor.setDaemon(true);
        acceptor.start();
    }

    @AfterEach
    void stopServer() throws IOException {
        server.close();
    }

    private void handle(Socket socket) throws IOException {
        BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.ISO_8859_1));
        StringBuilder head = new StringBuilder();
        String line;
        int contentLength = 0;
        while ((line = reader.readLine()) != null && !line.isEmpty()) {
            head.append(line).append('\n');
            if (line.toLowerCase().startsWith("content-length:")) {
                contentLength = Integer.parseInt(line.substring(15).trim());
            }
        }
        StringBuilder payload = new StringBuilder();
        if (head.toString().toLowerCase().contains("transfer-encoding: chunked")) {
            // The JDK client streams the body, so it arrives in chunks: a hex size line, the data, repeat, then 0.
            while ((line = reader.readLine()) != null) {
                int size = Integer.parseInt(line.trim(), 16);
                if (size == 0) {
                    break;
                }
                char[] chunk = new char[size];
                int got = 0;
                while (got < size) {
                    int n = reader.read(chunk, got, size - got);
                    if (n < 0) {
                        break;
                    }
                    got += n;
                }
                payload.append(chunk, 0, got);
                reader.readLine();
            }
        } else {
            char[] fixed = new char[contentLength];
            int got = 0;
            while (got < contentLength) {
                int n = reader.read(fixed, got, contentLength - got);
                if (n < 0) {
                    break;
                }
                got += n;
            }
            payload.append(fixed, 0, got);
        }
        lastRequest.set(head + payload.toString());

        if (head.toString().toLowerCase().contains("upgrade:")) {
            return; // what the auth service does: hang up, no reply
        }
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        OutputStream out = socket.getOutputStream();
        out.write(("HTTP/1.1 " + status + " X\r\nContent-Type: application/json\r\nContent-Length: "
                + bytes.length + "\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.ISO_8859_1));
        out.write(bytes);
        out.flush();
    }

    private AuthRegistrationClient client() {
        return new AuthRegistrationClient("http://localhost:" + server.getLocalPort());
    }

    @Test
    void getsAnAnswerFromAServerThatDropsUpgradeRequestsAndForwardsTheAdminToken() {
        boolean emailSent = client().register("priya.menon", "priya.menon@example.com", 21L, "Bearer admin-token");

        assertThat(emailSent).isTrue();
        String request = lastRequest.get();
        assertThat(request).startsWith("POST /auth/register");
        assertThat(request.toLowerCase()).contains("authorization: bearer admin-token");
        assertThat(request).contains("\"username\":\"priya.menon\"").contains("\"accountId\":21");
        // No password is ever sent: the auth service generates and emails it.
        assertThat(request.toLowerCase()).doesNotContain("password");
    }

    @Test
    void aDuplicateIsAConflict() {
        status = 409;
        body = "{\"errorCode\":\"AUTH-409\"}";

        assertThatThrownBy(() -> client().register("a.b", "a.b@example.com", 1L, "Bearer t"))
                .isInstanceOf(RegistrationException.class)
                .extracting(e -> ((RegistrationException) e).getCatalogueCode())
                .isEqualTo("REG-409");
    }

    @Test
    void anEmailFailureOnTheAuthSideIsReportedAsSuch() {
        status = 503;
        body = "{\"errorCode\":\"AUTH-503\"}";

        assertThatThrownBy(() -> client().register("a.b", "a.b@example.com", 1L, "Bearer t"))
                .isInstanceOf(RegistrationException.class)
                .extracting(e -> ((RegistrationException) e).getCatalogueCode())
                .isEqualTo("REG-503");
    }

    @Test
    void aRejectedAdminTokenIsABadGatewayNotALoginFailure() {
        status = 403;
        body = "{\"errorCode\":\"AUTH-403\"}";

        assertThatThrownBy(() -> client().register("a.b", "a.b@example.com", 1L, "Bearer t"))
                .isInstanceOf(RegistrationException.class)
                .extracting(e -> ((RegistrationException) e).getCatalogueCode())
                .isEqualTo("REG-502");
    }

    @Test
    void anUnreachableAuthServiceIsABadGateway() throws IOException {
        int port = server.getLocalPort();
        server.close();

        assertThatThrownBy(() -> new AuthRegistrationClient("http://localhost:" + port)
                .register("a.b", "a.b@example.com", 1L, "Bearer t"))
                .isInstanceOf(RegistrationException.class)
                .hasMessageContaining("could not be reached");
    }
}
