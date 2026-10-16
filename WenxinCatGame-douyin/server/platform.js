const nodeCrypto = require('crypto');
module.exports = { structuredClone: value => JSON.parse(JSON.stringify(value)), crypto: { randomUUID: () => nodeCrypto.randomUUID(), getRandomValues: array => nodeCrypto.randomFillSync(array) } };
