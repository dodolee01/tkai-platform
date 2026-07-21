/**
 * @file Registry and safe invocation of AI-callable tools (market
 * data, portfolio, indicators, risk, strategy, notification). Every
 * tool is a dependency-injected async function supplied by the host
 * application — this module never implements a tool's actual logic,
 * only validates the AI's requested call against the tool's declared
 * parameter schema and invokes it.
 * @module ai-core-engine/ToolExecutor
 */

/**
 * @param {object} args
 * @param {object} schema - JSON-schema-shaped: `{type: 'object', properties: {...}, required: [...]}`.
 * @returns {string[]} Validation error messages; empty if valid.
 * @private
 */
function validateArgs(args, schema) {
  const errors = [];
  if (!schema || !schema.properties) return errors;

  for (const requiredField of schema.required ?? []) {
    if (!(requiredField in args)) errors.push(`missing required parameter "${requiredField}"`);
  }

  for (const [key, value] of Object.entries(args)) {
    const propSchema = schema.properties[key];
    if (!propSchema) {
      errors.push(`unexpected parameter "${key}"`);
      continue;
    }
    if (propSchema.type && !matchesJsonSchemaType(value, propSchema.type)) {
      errors.push(`parameter "${key}" expected type "${propSchema.type}", got "${typeof value}"`);
    }
  }

  return errors;
}

/**
 * @param {*} value
 * @param {string} type
 * @returns {boolean}
 * @private
 */
function matchesJsonSchemaType(value, type) {
  switch (type) {
    case 'string': return typeof value === 'string';
    case 'number': return typeof value === 'number' && !Number.isNaN(value);
    case 'boolean': return typeof value === 'boolean';
    case 'object': return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array': return Array.isArray(value);
    default: return true;
  }
}

export class ToolExecutor {
  /**
   * @param {import('./types.js').Logger} [logger]
   */
  constructor(logger = null) {
    /** @private */ this._logger = logger;
    /** @private @type {Map<string, import('./types.js').ToolDefinition>} */
    this._tools = new Map();
  }

  /**
   * @param {import('./types.js').ToolDefinition} tool
   * @returns {void}
   */
  registerTool(tool) {
    if (typeof tool.execute !== 'function') throw new Error(`ToolExecutor.registerTool: "${tool.name}" must have an execute function`);
    this._tools.set(tool.name, tool);
  }

  /**
   * @returns {{name: string, description: string, parameters: object}[]} Tool definitions in the shape a {@link import('./types.js').CompletionRequest}'s `tools` field expects.
   */
  getToolDefinitions() {
    return Array.from(this._tools.values()).map((t) => ({ name: t.name, description: t.description, parameters: t.parameters }));
  }

  /**
   * @param {string} name
   * @returns {boolean}
   */
  hasTool(name) {
    return this._tools.has(name);
  }

  /**
   * Validate and execute a single tool call requested by the AI.
   * Never throws — a failed or invalid call returns a result object
   * with `success: false`, so a reasoning loop can report the
   * failure back to the model rather than crashing.
   * @param {import('./types.js').ToolCall} toolCall
   * @returns {Promise<{success: boolean, result: object|null, error: string|null}>}
   */
  async executeToolCall(toolCall) {
    const tool = this._tools.get(toolCall.name);
    if (!tool) {
      return { success: false, result: null, error: `no tool registered named "${toolCall.name}"` };
    }

    const validationErrors = validateArgs(toolCall.arguments ?? {}, tool.parameters);
    if (validationErrors.length > 0) {
      return { success: false, result: null, error: `invalid arguments: ${validationErrors.join('; ')}` };
    }

    try {
      const result = await tool.execute(toolCall.arguments ?? {});
      return { success: true, result, error: null };
    } catch (err) {
      this._logger?.error?.(`Tool "${toolCall.name}" execution failed`, { error: err.message });
      return { success: false, result: null, error: err.message };
    }
  }

  /**
   * Execute every tool call in a batch, independently (one failure
   * never blocks the others).
   * @param {import('./types.js').ToolCall[]} toolCalls
   * @returns {Promise<Array<{toolCallId: string, success: boolean, result: object|null, error: string|null}>>}
   */
  async executeToolCalls(toolCalls) {
    return Promise.all(
      toolCalls.map(async (tc) => ({ toolCallId: tc.id, ...(await this.executeToolCall(tc)) }))
    );
  }
}

export default ToolExecutor;
