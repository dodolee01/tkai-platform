/**
 * @file Orchestrates a tool-calling reasoning loop: send a prompt to
 * the AI, execute any tool calls it requests via {@link ToolExecutor},
 * feed the results back as tool messages, and repeat until the model
 * responds with a final answer (no further tool calls) or the
 * configured round limit is reached. This is what powers Bot Builder
 * parsing and any future capability that needs the AI to actively
 * gather data mid-response rather than reasoning from a single static prompt.
 * @module ai-core-engine/ReasoningEngine
 */

export class ReasoningEngine {
  /**
   * @param {Object} deps
   * @param {import('./AIManager.js').AIManager} deps.aiManager
   * @param {import('./ToolExecutor.js').ToolExecutor} deps.toolExecutor
   * @param {import('./types.js').Logger} [deps.logger]
   * @param {object} config - `config.reasoning` section.
   */
  constructor({ aiManager, toolExecutor, logger = null }, config) {
    /** @private */ this._aiManager = aiManager;
    /** @private */ this._toolExecutor = toolExecutor;
    /** @private */ this._logger = logger;
    /** @private */ this._config = config;
  }

  /**
   * Run the reasoning loop to completion.
   * @param {import('./types.js').CompletionRequest} initialRequest - Should include `tools` if tool use is desired.
   * @returns {Promise<{finalResponse: import('./types.js').CompletionResponse, trace: Array<{round: number, response: import('./types.js').CompletionResponse, toolResults: object[]}>}>}
   */
  async run(initialRequest) {
    const trace = [];
    let messages = [...initialRequest.messages];
    let round = 0;

    while (round < this._config.maxToolCallRounds) {
      const response = await this._aiManager.complete({ ...initialRequest, messages });

      if (response.toolCalls.length === 0) {
        trace.push({ round, response, toolResults: [] });
        return { finalResponse: response, trace };
      }

      const toolResults = await this._toolExecutor.executeToolCalls(response.toolCalls);
      trace.push({ round, response, toolResults });

      messages = [
        ...messages,
        { role: 'assistant', content: response.content },
        ...toolResults.map((r) => ({
          role: 'tool',
          toolCallId: r.toolCallId,
          content: r.success ? JSON.stringify(r.result) : JSON.stringify({ error: r.error }),
        })),
      ];

      round += 1;
    }

    this._logger?.warn?.('ReasoningEngine: reached maxToolCallRounds without a final answer', { rounds: round });
    const lastRoundResponse = trace[trace.length - 1]?.response;
    return { finalResponse: lastRoundResponse, trace };
  }
}

export default ReasoningEngine;
