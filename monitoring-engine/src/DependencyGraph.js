/**
 * @file Tracks dependency relationships between registered services
 * and computes cascading-impact analysis: if service X goes down,
 * which other services (directly or transitively depending on it)
 * are affected. Also detects dependency cycles, which would
 * otherwise make impact analysis loop forever.
 * @module monitoring-engine/DependencyGraph
 */

export class DependencyGraph {
  constructor() {
    /** @private @type {Map<string, Set<string>>} service -> set of services it depends ON */
    this._dependsOn = new Map();
    /** @private @type {Map<string, Set<string>>} service -> set of services that depend ON it (reverse edges) */
    this._dependents = new Map();
  }

  /**
   * @param {string} name
   * @returns {void}
   * @private
   */
  _ensureNode(name) {
    if (!this._dependsOn.has(name)) this._dependsOn.set(name, new Set());
    if (!this._dependents.has(name)) this._dependents.set(name, new Set());
  }

  /**
   * Declare that `serviceName` depends on `dependencyName`.
   * @param {string} serviceName
   * @param {string} dependencyName
   * @returns {void}
   */
  addDependency(serviceName, dependencyName) {
    this._ensureNode(serviceName);
    this._ensureNode(dependencyName);
    this._dependsOn.get(serviceName).add(dependencyName);
    this._dependents.get(dependencyName).add(serviceName);
  }

  /**
   * Register a service's full dependency list at once (e.g. from
   * {@link ServiceRegistry#register}'s `dependencies` field).
   * @param {string} serviceName
   * @param {string[]} dependencyNames
   * @returns {void}
   */
  setDependencies(serviceName, dependencyNames) {
    this._ensureNode(serviceName);
    for (const existingDep of this._dependsOn.get(serviceName)) {
      this._dependents.get(existingDep)?.delete(serviceName);
    }
    this._dependsOn.set(serviceName, new Set());
    for (const dep of dependencyNames) this.addDependency(serviceName, dep);
  }

  /**
   * @param {string} serviceName
   * @returns {string[]} Direct dependencies.
   */
  getDependencies(serviceName) {
    return Array.from(this._dependsOn.get(serviceName) ?? []);
  }

  /**
   * @param {string} serviceName
   * @returns {string[]} Services directly depending on this one.
   */
  getDependents(serviceName) {
    return Array.from(this._dependents.get(serviceName) ?? []);
  }

  /**
   * Compute every service transitively affected if `serviceName`
   * goes down (its direct and indirect dependents), safe against cycles.
   * @param {string} serviceName
   * @returns {string[]}
   */
  getCascadingImpact(serviceName) {
    const visited = new Set();
    const queue = [...this.getDependents(serviceName)];
    while (queue.length > 0) {
      const current = queue.shift();
      if (visited.has(current)) continue;
      visited.add(current);
      queue.push(...this.getDependents(current));
    }
    return Array.from(visited);
  }

  /**
   * Detect whether the dependency graph contains a cycle.
   * @returns {{hasCycle: boolean, cycle: string[]}}
   */
  detectCycle() {
    const visited = new Set();
    const inStack = new Set();
    const path = [];

    const visit = (node) => {
      visited.add(node);
      inStack.add(node);
      path.push(node);

      for (const dep of this._dependsOn.get(node) ?? []) {
        if (!visited.has(dep)) {
          const found = visit(dep);
          if (found) return found;
        } else if (inStack.has(dep)) {
          const cycleStart = path.indexOf(dep);
          return path.slice(cycleStart).concat(dep);
        }
      }

      inStack.delete(node);
      path.pop();
      return null;
    };

    for (const node of this._dependsOn.keys()) {
      if (!visited.has(node)) {
        const cycle = visit(node);
        if (cycle) return { hasCycle: true, cycle };
      }
    }
    return { hasCycle: false, cycle: [] };
  }

  /**
   * @returns {string[]} Every node currently in the graph.
   */
  getAllNodes() {
    return Array.from(this._dependsOn.keys());
  }
}

export default DependencyGraph;
