import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { WebSocketConnection } from '../../../src/scanner/websocket/WebSocketConnection.js';

/**
 * Fake WebSocket implementation for dependency-injected testing.
 * Mirrors the subset of the `ws` package API WebSocketConnection relies on.
 */
class FakeWebSocket extends EventEmitter {
  constructor(url) {
    super();
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    FakeWebSocket.instances.push(this);
    setTimeout(() => {
      this.readyState = 1;
      this.emit('open');
    }, 5);
  }
  send(data) { this.sent.push(data); }
  ping() { setTimeout(() => this.emit('pong'), 2); }
  pong() {}
  close() { this.readyState = 3; this.emit('close', 1000, 'closed'); }
  terminate() { this.readyState = 3; this.emit('close', 1006, 'terminated'); }
}
FakeWebSocket.instances = [];

function freshDeps() {
  FakeWebSocket.instances = [];
  return {
    url: 'wss://fake.example/stream',
    WebSocketImpl: FakeWebSocket,
    logger: { info(){}, warn(){}, error(){}, debug(){} },
    eventBus: { safeEmit: () => true },
    metrics: { recordMessage(){}, recordDroppedPacket(){}, recordLatency(){}, recordReconnect(){} },
  };
}

test('connect() resolves once the socket opens', async () => {
  const conn = new WebSocketConnection(freshDeps(), { heartbeatIntervalMs: 1e9, heartbeatTimeoutMs: 1e9 });
  await conn.connect();
  assert.equal(conn.state, 'open');
});

test('send() delivers when open and drops when not open', async () => {
  const conn = new WebSocketConnection(freshDeps(), { heartbeatIntervalMs: 1e9, heartbeatTimeoutMs: 1e9 });
  assert.equal(conn.send('too-early'), false); // not open yet
  await conn.connect();
  assert.equal(conn.send('hello'), true);
});

test('onMessage handlers receive parsed JSON payloads', async () => {
  const conn = new WebSocketConnection(freshDeps(), { heartbeatIntervalMs: 1e9, heartbeatTimeoutMs: 1e9 });
  await conn.connect();
  let received = null;
  conn.onMessage((data) => { received = data; });
  FakeWebSocket.instances[0].emit('message', JSON.stringify({ hello: 'world' }));
  assert.deepEqual(received, { hello: 'world' });
});

test('unexpected close triggers automatic reconnect with a fresh socket', async () => {
  const conn = new WebSocketConnection(freshDeps(), {
    heartbeatIntervalMs: 1e9,
    heartbeatTimeoutMs: 1e9,
    reconnect: { initialDelayMs: 5, maxDelayMs: 20 },
  });
  await conn.connect();
  const countBefore = FakeWebSocket.instances.length;
  FakeWebSocket.instances[0].readyState = 3;
  FakeWebSocket.instances[0].emit('close', 1006, 'abnormal');
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(FakeWebSocket.instances.length, countBefore + 1);
  assert.equal(conn.state, 'open');
});

test('resubscribeHook is invoked after a reconnect', async () => {
  let hookCalls = 0;
  const conn = new WebSocketConnection(freshDeps(), {
    heartbeatIntervalMs: 1e9,
    heartbeatTimeoutMs: 1e9,
    reconnect: { initialDelayMs: 5, maxDelayMs: 20 },
    resubscribeHook: () => { hookCalls += 1; },
  });
  await conn.connect();
  assert.equal(hookCalls, 1); // called after initial connect too
  FakeWebSocket.instances[0].readyState = 3;
  FakeWebSocket.instances[0].emit('close', 1006, 'abnormal');
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(hookCalls, 2);
});

test('close() disables reconnect and settles state to closed', async () => {
  const conn = new WebSocketConnection(freshDeps(), { heartbeatIntervalMs: 1e9, heartbeatTimeoutMs: 1e9 });
  await conn.connect();
  await conn.close();
  assert.equal(conn.state, 'closed');
  const countBefore = FakeWebSocket.instances.length;
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(FakeWebSocket.instances.length, countBefore); // no reconnect after graceful close
});

test('heartbeat timeout terminates a dead connection (triggering reconnect)', async () => {
  const conn = new WebSocketConnection(freshDeps(), {
    heartbeatIntervalMs: 10,
    heartbeatTimeoutMs: 5,
    reconnect: { initialDelayMs: 5, maxDelayMs: 20 },
  });
  await conn.connect();
  // Make the socket stop responding to pings (simulate a dead connection).
  FakeWebSocket.instances[0].ping = () => {}; // no pong emitted
  const countBefore = FakeWebSocket.instances.length;
  await new Promise((r) => setTimeout(r, 100));
  assert.ok(FakeWebSocket.instances.length > countBefore, 'expected a reconnect after heartbeat timeout');
});
