/**
 * @file Notification persistence contract. Per this module's
 * requirements, only the interface is defined here — no
 * database-specific implementation (PocketBase, PostgreSQL, MongoDB,
 * etc.) is bundled. An {@link InMemoryNotificationRepository} is
 * provided as the default, dependency-free implementation so the
 * engine is usable out of the box and in tests; it is not a database
 * and does not violate the "interfaces only" requirement.
 * @module notification-engine/NotificationRepository
 */

/**
 * The storage contract every notification repository implementation
 * must satisfy.
 * @interface NotificationRepositoryContract
 */
/** @function @name NotificationRepositoryContract#save @param {import('./types.js').Notification} notification @returns {Promise<import('./types.js').Notification>} */
/** @function @name NotificationRepositoryContract#getById @param {string} id @returns {Promise<import('./types.js').Notification|null>} */
/** @function @name NotificationRepositoryContract#query @param {object} filter @returns {Promise<import('./types.js').Notification[]>} */
/** @function @name NotificationRepositoryContract#saveDeliveryRecord @param {import('./DeliveryTracker.js').DeliveryRecord} record @returns {Promise<void>} */

/**
 * Abstract base class defining the notification repository contract.
 * @abstract
 */
export class NotificationRepository {
  constructor() {
    if (new.target === NotificationRepository) {
      throw new Error('NotificationRepository is abstract and cannot be instantiated directly');
    }
  }

  /**
   * @param {string} methodName
   * @returns {never}
   * @protected
   */
  _notImplemented(methodName) {
    throw new Error(`${this.constructor.name} does not implement NotificationRepository#${methodName}`);
  }

  /** @param {import('./types.js').Notification} _notification @returns {Promise<import('./types.js').Notification>} */
  async save(_notification) { this._notImplemented('save'); }

  /** @param {string} _id @returns {Promise<import('./types.js').Notification|null>} */
  async getById(_id) { this._notImplemented('getById'); }

  /** @param {object} _filter @returns {Promise<import('./types.js').Notification[]>} */
  async query(_filter) { this._notImplemented('query'); }

  /** @param {import('./DeliveryTracker.js').DeliveryRecord} _record @returns {Promise<void>} */
  async saveDeliveryRecord(_record) { this._notImplemented('saveDeliveryRecord'); }
}

/**
 * In-memory implementation of {@link NotificationRepository}. The
 * default used when no external repository is injected; also what
 * the test suite exercises against.
 * @extends NotificationRepository
 */
export class InMemoryNotificationRepository extends NotificationRepository {
  constructor() {
    super();
    /** @private @type {Map<string, import('./types.js').Notification>} */
    this._notifications = new Map();
    /** @private @type {import('./DeliveryTracker.js').DeliveryRecord[]} */
    this._deliveryRecords = [];
  }

  /** @param {import('./types.js').Notification} notification @returns {Promise<import('./types.js').Notification>} */
  async save(notification) {
    this._notifications.set(notification.id, { ...notification });
    return notification;
  }

  /** @param {string} id @returns {Promise<import('./types.js').Notification|null>} */
  async getById(id) {
    return this._notifications.get(id) ?? null;
  }

  /**
   * @param {object} [filter]
   * @param {string} [filter.userId]
   * @param {string} [filter.type]
   * @returns {Promise<import('./types.js').Notification[]>}
   */
  async query(filter = {}) {
    let all = Array.from(this._notifications.values());
    if (filter.userId !== undefined) all = all.filter((n) => n.userId === filter.userId);
    if (filter.type !== undefined) all = all.filter((n) => n.type === filter.type);
    return all;
  }

  /** @param {import('./DeliveryTracker.js').DeliveryRecord} record @returns {Promise<void>} */
  async saveDeliveryRecord(record) {
    this._deliveryRecords.push({ ...record });
  }

  /** @returns {Promise<import('./DeliveryTracker.js').DeliveryRecord[]>} */
  async getDeliveryRecords() {
    return this._deliveryRecords.slice();
  }
}

export default { NotificationRepository, InMemoryNotificationRepository };
