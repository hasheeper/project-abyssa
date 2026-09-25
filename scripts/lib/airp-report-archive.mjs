/** Isolated report whitespace is not game data; production still validates all content and limits.
 * @param {string} serialized
 */
export const compactReportArchive = serialized => JSON.stringify(JSON.parse(serialized));
