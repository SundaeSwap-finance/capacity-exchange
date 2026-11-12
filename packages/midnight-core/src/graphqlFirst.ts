/**
 * Loads graphql before anything that reaches @apollo/client.
 *
 * Under Bun, @apollo/client pulls in graphql-tag's CommonJS build, which require()s graphql.
 * graphql 17 resolves to its ES module build there, and Bun refuses to require() an ES module
 * whose evaluation is still pending ("require() async module ... is unsupported"). Evaluating
 * graphql first, as a plain import, leaves nothing pending when graphql-tag asks for it.
 *
 * Import this (or `graphql` itself) before `@midnight-ntwrk/midnight-js-indexer-public-data-provider`.
 */
import 'graphql';
