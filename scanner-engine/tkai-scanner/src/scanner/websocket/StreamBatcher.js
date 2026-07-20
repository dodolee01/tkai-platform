/**
 * @file Pure utility for splitting large stream-name lists into
 * Binance-compliant subscription batches.
 * @module scanner/websocket/StreamBatcher
 */

/**
 * Split an array of stream names into fixed-size batches, suitable
 * for Binance combined-stream SUBSCRIBE/UNSUBSCRIBE requests (which
 * cap the number of params per request).
 * @param {string[]} streamNames
 * @param {number} [batchSize=50]
 * @returns {string[][]}
 */
export function batchStreams(streamNames, batchSize = 50) {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error('batchStreams: batchSize must be a positive integer');
  }
  const batches = [];
  for (let i = 0; i < streamNames.length; i += batchSize) {
    batches.push(streamNames.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Distribute a list of symbols evenly across N connections (or workers),
 * used to keep each websocket connection under Binance's per-connection
 * stream limit and to balance load across worker threads.
 * @param {string[]} symbols
 * @param {number} groupCount - Number of connections/workers to spread across.
 * @returns {string[][]} `groupCount` arrays, as evenly sized as possible.
 */
export function distributeEvenly(symbols, groupCount) {
  if (!Number.isInteger(groupCount) || groupCount < 1) {
    throw new Error('distributeEvenly: groupCount must be a positive integer');
  }
  const groups = Array.from({ length: groupCount }, () => []);
  symbols.forEach((symbol, idx) => {
    groups[idx % groupCount].push(symbol);
  });
  return groups;
}

export default { batchStreams, distributeEvenly };
