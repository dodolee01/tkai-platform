/**
 * @file Shared JSDoc type definitions for the AI core engine's
 * public contract. No runtime logic. Context inputs are duck-typed
 * against the shapes reported by Modules 1–10 — this module never
 * imports their source.
 * @module ai-core-engine/types
 */

/**
 * @typedef {'system'|'user'|'assistant'|'tool'} MessageRole
 */

/**
 * @typedef {Object} ChatMessage
 * @property {MessageRole} role
 * @property {string} content
 * @property {string} [toolCallId] - Set on `role: 'tool'` messages, correlating to the originating tool call.
 * @property {string} [name] - Optional speaker name.
 */

/**
 * @typedef {Object} ToolDefinition
 * @property {string} name
 * @property {string} description
 * @property {object} parameters - JSON-schema-shaped parameter description.
 * @property {(args: object) => Promise<object>} execute - Injected implementation.
 */

/**
 * @typedef {Object} ToolCall
 * @property {string} id
 * @property {string} name
 * @property {object} arguments
 */

/**
 * The interface every AI provider implements. Duck-typed — no shared
 * base class, since providers differ entirely in their constructor
 * dependencies (API shape, auth scheme).
 * @interface AIProvider
 */
/** @member {string} AIProvider#name */
/** @member {ProviderCapabilities} AIProvider#capabilities */
/** @function @name AIProvider#complete @param {CompletionRequest} request @returns {Promise<CompletionResponse>} */

/**
 * @typedef {Object} ProviderCapabilities
 * @property {number} maxContextTokens
 * @property {boolean} supportsTools
 * @property {boolean} supportsStreaming
 * @property {boolean} supportsVision
 * @property {number} costPerPromptToken - In USD.
 * @property {number} costPerCompletionToken - In USD.
 * @property {number} averageLatencyMs - Rolling average, updated by {@link AIProviderManager}.
 */

/**
 * @typedef {Object} CompletionRequest
 * @property {ChatMessage[]} messages
 * @property {string} [model]
 * @property {number} [temperature]
 * @property {number} [maxTokens]
 * @property {ToolDefinition[]} [tools]
 * @property {string} [userId]
 * @property {string} [preferredProvider]
 * @property {'cost'|'latency'|'quality'} [routingPriority]
 */

/**
 * @typedef {Object} TokenUsage
 * @property {number} promptTokens
 * @property {number} completionTokens
 * @property {number} totalTokens
 */

/**
 * @typedef {Object} CompletionResponse
 * @property {string} content
 * @property {ToolCall[]} toolCalls
 * @property {string} provider
 * @property {string} model
 * @property {TokenUsage} usage
 * @property {number} estimatedCostUsd
 * @property {number} latencyMs
 * @property {boolean} cached
 */

/**
 * A duck-typed snapshot of platform context, assembled by
 * {@link ContextBuilder} from Modules 1–10's own output shapes.
 * @typedef {Object} PlatformContext
 * @property {object} [scanner]
 * @property {object} [indicators]
 * @property {object} [decision]
 * @property {object} [risk]
 * @property {object} [execution]
 * @property {object} [position]
 * @property {object} [portfolio]
 * @property {object} [analytics]
 * @property {object} [learning]
 * @property {object} [notification]
 */

/**
 * @typedef {Object} AnalysisResult
 * @property {string} summary - Natural-language explanation.
 * @property {object} data - Structured findings.
 * @property {number} confidence - 0..1
 * @property {string[]} [warnings]
 */

export default {};
