/**
 * SSE Load Testing Script
 *
 * Tests Server-Sent Events (SSE) performance for the notification stream.
 * Measures connection handling, message delivery, and reconnection behavior.
 *
 * Usage:
 *   DB_TYPE=postgres DATABASE_URL="..." bun run src/tests/load/sse-load-test.ts
 *
 * @module tests/load/sse-load-test
 */

import { EventSource } from "eventsource";

// Configuration
const BASE_URL = process.env.TEST_URL || "http://localhost:3000";
const SSE_ENDPOINT = `${BASE_URL}/api/notifications/stream`;

// Test tokens - these should be valid session tokens for testing
// In a real scenario, create test users and get their tokens
const TEST_TOKENS = process.env.TEST_TOKENS?.split(",") || [];

interface ConnectionMetrics {
  connectionId: number;
  userId: string;
  connectedAt: number;
  disconnectedAt?: number;
  messagesReceived: number;
  errors: string[];
  latencies: number[];
  reconnectCount: number;
}

interface TestResults {
  totalConnections: number;
  successfulConnections: number;
  failedConnections: number;
  totalMessages: number;
  averageLatency: number;
  maxLatency: number;
  minLatency: number;
  totalReconnects: number;
  testDurationMs: number;
  connectionsPerSecond: number;
  messagesPerSecond: number;
  errors: string[];
}

class SSELoadTester {
  private connections: Map<number, EventSource> = new Map();
  private metrics: Map<number, ConnectionMetrics> = new Map();
  private connectionIdCounter = 0;
  private testStartTime = 0;

  /**
   * Create a single SSE connection
   */
  private createConnection(token: string, connectionId: number): Promise<ConnectionMetrics> {
    return new Promise((resolve, reject) => {
      const url = `${SSE_ENDPOINT}?token=${encodeURIComponent(token)}`;
      const metrics: ConnectionMetrics = {
        connectionId,
        userId: "",
        connectedAt: Date.now(),
        messagesReceived: 0,
        errors: [],
        latencies: [],
        reconnectCount: 0,
      };

      this.metrics.set(connectionId, metrics);

      const eventSource = new EventSource(url);
      this.connections.set(connectionId, eventSource);

      const connectionTimeout = setTimeout(() => {
        if (eventSource.readyState !== EventSource.OPEN) {
          metrics.errors.push("Connection timeout");
          eventSource.close();
          reject(new Error("Connection timeout"));
        }
      }, 10000);

      eventSource.addEventListener("connected", (event: MessageEvent) => {
        clearTimeout(connectionTimeout);
        try {
          const data = JSON.parse(event.data);
          metrics.userId = data.userId;
          console.log(`[${connectionId}] Connected as user: ${data.userId}`);
        } catch (e) {
          metrics.errors.push(`Failed to parse connected event: ${e}`);
        }
      });

      eventSource.addEventListener("notification", (event: MessageEvent) => {
        const receiveTime = Date.now();
        metrics.messagesReceived++;
        try {
          const data = JSON.parse(event.data);
          // If the notification has a timestamp, calculate latency
          if (data.createdAt) {
            const latency = receiveTime - new Date(data.createdAt).getTime();
            if (latency > 0 && latency < 60000) {
              // Sanity check
              metrics.latencies.push(latency);
            }
          }
        } catch (e) {
          metrics.errors.push(`Failed to parse notification: ${e}`);
        }
      });

      eventSource.addEventListener("unreadCount", () => {
        metrics.messagesReceived++;
      });

      eventSource.addEventListener("heartbeat", () => {
        // Heartbeat received - connection is alive
      });

      eventSource.onerror = (error: Event) => {
        const errMsg = `Connection error: ${(error as any).message || "Unknown error"}`;
        metrics.errors.push(errMsg);
        console.error(`[${connectionId}] ${errMsg}`);

        if (eventSource.readyState === EventSource.CLOSED) {
          metrics.disconnectedAt = Date.now();
        }
      };

      eventSource.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log(`[${connectionId}] Connection opened`);
        resolve(metrics);
      };
    });
  }

  /**
   * Close a connection
   */
  private closeConnection(connectionId: number): void {
    const eventSource = this.connections.get(connectionId);
    if (eventSource) {
      eventSource.close();
      this.connections.delete(connectionId);
      const metrics = this.metrics.get(connectionId);
      if (metrics && !metrics.disconnectedAt) {
        metrics.disconnectedAt = Date.now();
      }
    }
  }

  /**
   * Run concurrent connection test
   */
  async testConcurrentConnections(
    tokens: string[],
    connectionsPerToken: number = 1,
  ): Promise<TestResults> {
    console.log("\n=== SSE Concurrent Connection Test ===");
    console.log(`Tokens: ${tokens.length}, Connections per token: ${connectionsPerToken}`);
    console.log(`Total expected connections: ${tokens.length * connectionsPerToken}`);

    this.testStartTime = Date.now();
    const connectionPromises: Promise<ConnectionMetrics>[] = [];

    // Create connections
    for (const token of tokens) {
      for (let i = 0; i < connectionsPerToken; i++) {
        const connectionId = this.connectionIdCounter++;
        connectionPromises.push(
          this.createConnection(token, connectionId).catch((error) => {
            console.error(`Connection ${connectionId} failed:`, error.message);
            return {
              connectionId,
              userId: "",
              connectedAt: Date.now(),
              messagesReceived: 0,
              errors: [error.message],
              latencies: [],
              reconnectCount: 0,
            };
          }),
        );
      }
    }

    // Wait for all connections
    const results = await Promise.all(connectionPromises);

    return this.calculateResults(results);
  }

  /**
   * Run ramp-up test (gradually increase connections)
   */
  async testRampUp(
    tokens: string[],
    targetConnections: number,
    rampUpDurationMs: number,
  ): Promise<TestResults> {
    console.log("\n=== SSE Ramp-Up Test ===");
    console.log(
      `Target connections: ${targetConnections}, Ramp-up duration: ${rampUpDurationMs}ms`,
    );

    this.testStartTime = Date.now();
    const intervalMs = rampUpDurationMs / targetConnections;
    const connectionPromises: Promise<ConnectionMetrics>[] = [];

    for (let i = 0; i < targetConnections; i++) {
      const token = tokens[i % tokens.length]!;
      const connectionId = this.connectionIdCounter++;

      connectionPromises.push(
        new Promise((resolve) => {
          setTimeout(() => {
            this.createConnection(token, connectionId)
              .then(resolve)
              .catch((error) => {
                console.error(`Connection ${connectionId} failed:`, error.message);
                resolve({
                  connectionId,
                  userId: "",
                  connectedAt: Date.now(),
                  messagesReceived: 0,
                  errors: [error.message],
                  latencies: [],
                  reconnectCount: 0,
                });
              });
          }, i * intervalMs);
        }),
      );
    }

    const results = await Promise.all(connectionPromises);
    return this.calculateResults(results);
  }

  /**
   * Run sustained load test
   */
  async testSustainedLoad(
    tokens: string[],
    connections: number,
    durationMs: number,
  ): Promise<TestResults> {
    console.log("\n=== SSE Sustained Load Test ===");
    console.log(`Connections: ${connections}, Duration: ${durationMs}ms`);

    this.testStartTime = Date.now();

    // Create initial connections
    const connectionPromises: Promise<ConnectionMetrics>[] = [];
    for (let i = 0; i < connections; i++) {
      const token = tokens[i % tokens.length]!;
      const connectionId = this.connectionIdCounter++;
      connectionPromises.push(
        this.createConnection(token, connectionId).catch((error) => ({
          connectionId,
          userId: "",
          connectedAt: Date.now(),
          messagesReceived: 0,
          errors: [error.message],
          latencies: [],
          reconnectCount: 0,
        })),
      );
    }

    await Promise.all(connectionPromises);

    console.log(`All ${connections} connections established. Sustaining for ${durationMs}ms...`);

    // Wait for test duration
    await new Promise((resolve) => setTimeout(resolve, durationMs));

    // Collect final metrics
    const results = Array.from(this.metrics.values());
    return this.calculateResults(results);
  }

  /**
   * Calculate test results from metrics
   */
  private calculateResults(metrics: ConnectionMetrics[]): TestResults {
    const testDurationMs = Date.now() - this.testStartTime;
    const successfulConnections = metrics.filter((m) => m.userId !== "").length;
    const failedConnections = metrics.length - successfulConnections;
    const totalMessages = metrics.reduce((sum, m) => sum + m.messagesReceived, 0);
    const allLatencies = metrics.flatMap((m) => m.latencies);
    const totalReconnects = metrics.reduce((sum, m) => sum + m.reconnectCount, 0);
    const allErrors = metrics.flatMap((m) => m.errors);

    const averageLatency =
      allLatencies.length > 0
        ? allLatencies.reduce((sum, l) => sum + l, 0) / allLatencies.length
        : 0;
    const maxLatency = allLatencies.length > 0 ? Math.max(...allLatencies) : 0;
    const minLatency = allLatencies.length > 0 ? Math.min(...allLatencies) : 0;

    return {
      totalConnections: metrics.length,
      successfulConnections,
      failedConnections,
      totalMessages,
      averageLatency,
      maxLatency,
      minLatency,
      totalReconnects,
      testDurationMs,
      connectionsPerSecond: (successfulConnections / testDurationMs) * 1000,
      messagesPerSecond: (totalMessages / testDurationMs) * 1000,
      errors: [...new Set(allErrors)], // Unique errors
    };
  }

  /**
   * Clean up all connections
   */
  cleanup(): void {
    console.log("\nCleaning up connections...");
    for (const connectionId of this.connections.keys()) {
      this.closeConnection(connectionId);
    }
    this.metrics.clear();
    console.log("Cleanup complete.");
  }

  /**
   * Print test results
   */
  printResults(results: TestResults): void {
    console.log("\n=== Test Results ===");
    console.log(`Total Connections: ${results.totalConnections}`);
    console.log(`Successful: ${results.successfulConnections}`);
    console.log(`Failed: ${results.failedConnections}`);
    console.log(
      `Success Rate: ${((results.successfulConnections / results.totalConnections) * 100).toFixed(2)}%`,
    );
    console.log(`\nMessages:`);
    console.log(`  Total Received: ${results.totalMessages}`);
    console.log(`  Messages/Second: ${results.messagesPerSecond.toFixed(2)}`);
    console.log(`\nLatency (ms):`);
    console.log(`  Average: ${results.averageLatency.toFixed(2)}`);
    console.log(`  Min: ${results.minLatency}`);
    console.log(`  Max: ${results.maxLatency}`);
    console.log(`\nReconnects: ${results.totalReconnects}`);
    console.log(`Test Duration: ${(results.testDurationMs / 1000).toFixed(2)}s`);
    console.log(`Connections/Second: ${results.connectionsPerSecond.toFixed(2)}`);

    if (results.errors.length > 0) {
      console.log(`\nErrors (${results.errors.length} unique):`);
      results.errors.slice(0, 10).forEach((e) => console.log(`  - ${e}`));
      if (results.errors.length > 10) {
        console.log(`  ... and ${results.errors.length - 10} more`);
      }
    }
  }
}

/**
 * Create test tokens by logging in test users
 */
async function createTestTokens(userCount: number): Promise<string[]> {
  console.log(`Creating ${userCount} test users and tokens...`);

  const tokens: string[] = [];

  for (let i = 0; i < userCount; i++) {
    try {
      // Try to register a new user
      const username = `loadtest_${Date.now()}_${i}`;
      const registerResponse = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password: "testpassword123!",
          email: `${username}@test.local`,
        }),
      });

      if (registerResponse.ok) {
        const data = (await registerResponse.json()) as { token: string };
        tokens.push(data.token);
        console.log(`  Created user ${i + 1}/${userCount}: ${username}`);
      } else {
        console.error(`  Failed to create user ${i + 1}:`, await registerResponse.text());
      }
    } catch (error) {
      console.error(`  Error creating user ${i + 1}:`, error);
    }
  }

  return tokens;
}

/**
 * Main test runner
 */
async function main() {
  const tester = new SSELoadTester();

  try {
    // Get or create test tokens
    let tokens = TEST_TOKENS;

    if (tokens.length === 0) {
      console.log("No TEST_TOKENS provided. Creating test users...");
      tokens = await createTestTokens(5);

      if (tokens.length === 0) {
        console.error("Failed to create any test tokens. Exiting.");
        process.exit(1);
      }
    }

    console.log(`\nUsing ${tokens.length} test tokens`);

    // Test 1: Concurrent connections
    console.log("\n" + "=".repeat(50));
    const concurrentResults = await tester.testConcurrentConnections(tokens, 2);
    tester.printResults(concurrentResults);
    tester.cleanup();

    // Small delay between tests
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Test 2: Ramp-up test
    console.log("\n" + "=".repeat(50));
    const rampUpResults = await tester.testRampUp(tokens, 10, 5000);
    tester.printResults(rampUpResults);
    tester.cleanup();

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Test 3: Sustained load
    console.log("\n" + "=".repeat(50));
    const sustainedResults = await tester.testSustainedLoad(tokens, 5, 10000);
    tester.printResults(sustainedResults);
    tester.cleanup();

    console.log("\n=== All Tests Complete ===");
  } catch (error) {
    console.error("Test failed:", error);
    tester.cleanup();
    process.exit(1);
  }
}

// Run if executed directly
main().catch(console.error);
