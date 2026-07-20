/**
 * @file Public barrel export for the notification-engine module.
 * @module notification-engine
 */

export { NotificationEngine } from './NotificationEngine.js';
export { createConfig, DEFAULT_CONFIG } from './Config.js';
export { NotificationManager } from './NotificationManager.js';
export { NotificationDispatcher } from './NotificationDispatcher.js';
export { NotificationQueue } from './NotificationQueue.js';
export { Priority, PRIORITY_ORDER, priorityRank, comparePriority, resolveChannels } from './NotificationPriority.js';
export { NotificationHistory } from './NotificationHistory.js';
export { NotificationRepository, InMemoryNotificationRepository } from './NotificationRepository.js';
export { TelegramProvider } from './TelegramProvider.js';
export { DiscordProvider } from './DiscordProvider.js';
export { SlackProvider } from './SlackProvider.js';
export { EmailProvider } from './EmailProvider.js';
export { WebhookProvider } from './WebhookProvider.js';
export { PushProvider } from './PushProvider.js';
export { SMSProvider } from './SMSProvider.js';
export { DesktopProvider } from './DesktopProvider.js';
export { SoundAlert } from './SoundAlert.js';
export { AlertRules } from './AlertRules.js';
export { AlertTemplates } from './AlertTemplates.js';
export { DeduplicationEngine, computeDedupeKey } from './DeduplicationEngine.js';
export { RateLimiter } from './RateLimiter.js';
export { RetryManager } from './RetryManager.js';
export { DeliveryTracker, DeliveryStatus } from './DeliveryTracker.js';
export { HealthMonitor } from './HealthMonitor.js';
export { Metrics } from './Metrics.js';
export { Logger } from './Logger.js';

export { NotificationEngine as default } from './NotificationEngine.js';
