import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { TelegramProvider } from '../src/TelegramProvider.js';
import { DiscordProvider } from '../src/DiscordProvider.js';
import { SlackProvider } from '../src/SlackProvider.js';
import { WebhookProvider } from '../src/WebhookProvider.js';
import { SMSProvider } from '../src/SMSProvider.js';
import { EmailProvider } from '../src/EmailProvider.js';
import { PushProvider } from '../src/PushProvider.js';
import { DesktopProvider } from '../src/DesktopProvider.js';
import { SoundAlert } from '../src/SoundAlert.js';
import { Priority } from '../src/NotificationPriority.js';

function makeNotif(overrides = {}) {
  return { id: 'n1', type: 'tradeOpen', priority: Priority.HIGH, title: 'Trade Opened', body: 'BTCUSDT LONG', data: {}, createdAt: Date.now(), ...overrides };
}

test('every provider constructor requires its documented dependencies', () => {
  assert.throws(() => new TelegramProvider({ httpClient: async () => {} }));
  assert.throws(() => new DiscordProvider({ httpClient: async () => {} }));
  assert.throws(() => new SlackProvider({ httpClient: async () => {} }));
  assert.throws(() => new WebhookProvider({ httpClient: async () => {} }));
  assert.throws(() => new SMSProvider({ httpClient: async () => {} }));
  assert.throws(() => new EmailProvider({ fromAddress: 'x@y.com' }));
  assert.throws(() => new PushProvider({}));
  assert.throws(() => new DesktopProvider({}));
  assert.throws(() => new SoundAlert({}));
});

test('TelegramProvider sends a correctly-shaped Bot API request', async () => {
  const captured = [];
  const httpClient = (url, opts) => { captured.push({ url, opts }); return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 1 } }) }); };
  const provider = new TelegramProvider({ botToken: 'T', chatId: 'C', httpClient });
  const result = await provider.send(makeNotif());
  assert.equal(result.success, true);
  assert.equal(captured[0].url, 'https://api.telegram.org/botT/sendMessage');
  const body = JSON.parse(captured[0].opts.body);
  assert.equal(body.chat_id, 'C');
});

test('TelegramProvider surfaces API-level errors', async () => {
  const httpClient = async () => ({ ok: false, status: 400, json: async () => ({ ok: false, description: 'chat not found' }) });
  const provider = new TelegramProvider({ botToken: 'T', chatId: 'C', httpClient });
  const result = await provider.send(makeNotif());
  assert.equal(result.success, false);
  assert.equal(result.error, 'chat not found');
});

test('DiscordProvider sends an embed with a priority-derived color', async () => {
  const captured = [];
  const httpClient = (url, opts) => { captured.push({ url, opts }); return Promise.resolve({ ok: true, status: 204, json: async () => { throw new Error('empty'); } }); };
  const provider = new DiscordProvider({ webhookUrl: 'https://discord.test/hook', httpClient });
  const result = await provider.send(makeNotif({ priority: Priority.CRITICAL }));
  assert.equal(result.success, true);
  const body = JSON.parse(captured[0].opts.body);
  assert.equal(body.embeds[0].color, 0xe74c3c);
});

test('SlackProvider posts text and a Block Kit section block', async () => {
  const captured = [];
  const httpClient = (url, opts) => { captured.push({ url, opts }); return Promise.resolve({ ok: true, status: 200, text: async () => 'ok' }); };
  const provider = new SlackProvider({ webhookUrl: 'https://slack.test/hook', httpClient });
  const result = await provider.send(makeNotif());
  assert.equal(result.success, true);
  const body = JSON.parse(captured[0].opts.body);
  assert.equal(body.blocks[0].type, 'section');
});

test('WebhookProvider signs the body with HMAC-SHA256 when a secret is configured', async () => {
  const captured = [];
  const httpClient = (url, opts) => { captured.push({ url, opts }); return Promise.resolve({ ok: true, status: 200 }); };
  const provider = new WebhookProvider({ url: 'https://x.test/hook', httpClient, signingSecret: 'sekret' });
  await provider.send(makeNotif());
  const expected = createHmac('sha256', 'sekret').update(captured[0].opts.body).digest('hex');
  assert.equal(captured[0].opts.headers['X-Signature'], expected);
});

test('SMSProvider builds the real Twilio Messages REST request shape', async () => {
  const captured = [];
  const httpClient = (url, opts) => { captured.push({ url, opts }); return Promise.resolve({ ok: true, status: 201, json: async () => ({ sid: 'SM1' }) }); };
  const provider = new SMSProvider({ accountSid: 'AC1', authToken: 'tok', fromNumber: '+10000000000', httpClient });
  const result = await provider.send(makeNotif({ data: { phoneNumber: '+19999999999' } }));
  assert.equal(result.success, true);
  assert.equal(captured[0].url, 'https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json');
  assert.equal(captured[0].opts.headers.Authorization, `Basic ${Buffer.from('AC1:tok').toString('base64')}`);
});

test('SMSProvider fails gracefully with no phoneNumber', async () => {
  const httpClient = async () => ({ ok: true, status: 201, json: async () => ({}) });
  const provider = new SMSProvider({ accountSid: 'AC1', authToken: 'tok', fromNumber: '+1', httpClient });
  const result = await provider.send(makeNotif());
  assert.equal(result.success, false);
});

test('EmailProvider calls the injected mailer with correct fields and escapes HTML', async () => {
  const calls = [];
  const mailer = async (opts) => { calls.push(opts); return { messageId: 'm1' }; };
  const provider = new EmailProvider({ mailer, fromAddress: 'a@b.com', defaultToAddress: 'c@d.com' });
  const result = await provider.send(makeNotif({ title: '<b>x</b>' }));
  assert.equal(result.success, true);
  assert.ok(calls[0].html.includes('&lt;b&gt;'));
});

test('PushProvider fails gracefully without a deviceToken and succeeds with one', async () => {
  const pushTransport = async () => 'msg-id';
  const provider = new PushProvider({ pushTransport });
  const noToken = await provider.send(makeNotif());
  assert.equal(noToken.success, false);
  const withToken = await provider.send(makeNotif({ data: { deviceToken: 'abc' } }));
  assert.equal(withToken.success, true);
});

test('DesktopProvider flags sound for HIGH/CRITICAL priority only', async () => {
  const calls = [];
  const notifier = async (opts) => { calls.push(opts); };
  const provider = new DesktopProvider({ notifier });
  await provider.send(makeNotif({ priority: Priority.CRITICAL }));
  await provider.send(makeNotif({ priority: Priority.INFO }));
  assert.equal(calls[0].sound, true);
  assert.equal(calls[1].sound, false);
});

test('SoundAlert plays the priority-specific file, falling back to default', async () => {
  const calls = [];
  const soundPlayer = async (file) => { calls.push(file); };
  const alert = new SoundAlert({ soundPlayer }, { CRITICAL: '/c.mp3', default: '/d.mp3' });
  await alert.send(makeNotif({ priority: Priority.CRITICAL }));
  await alert.send(makeNotif({ priority: Priority.LOW }));
  assert.deepEqual(calls, ['/c.mp3', '/d.mp3']);
});

test('every provider exposes a stable "channel" identifier', () => {
  const httpClient = async () => ({ ok: true, status: 200, json: async () => ({}) });
  assert.equal(new TelegramProvider({ botToken: 'a', chatId: 'b', httpClient }).channel, 'telegram');
  assert.equal(new DiscordProvider({ webhookUrl: 'x', httpClient }).channel, 'discord');
  assert.equal(new SlackProvider({ webhookUrl: 'x', httpClient }).channel, 'slack');
  assert.equal(new WebhookProvider({ url: 'x', httpClient }).channel, 'webhook');
  assert.equal(new SMSProvider({ accountSid: 'a', authToken: 'b', fromNumber: 'c', httpClient }).channel, 'sms');
  assert.equal(new EmailProvider({ mailer: async () => {}, fromAddress: 'a@b.com' }).channel, 'email');
  assert.equal(new PushProvider({ pushTransport: async () => {} }).channel, 'push');
  assert.equal(new DesktopProvider({ notifier: async () => {} }).channel, 'desktop');
  assert.equal(new SoundAlert({ soundPlayer: async () => {} }).channel, 'sound');
});
