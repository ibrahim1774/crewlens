const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// pdf.js ships as ES modules; bundled under a private extension so Metro treats them as assets.
config.resolver.assetExts.push('pdfjs');

module.exports = config;
