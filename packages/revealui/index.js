// Main RevealUI exports
module.exports = {
  // Existing functionality
  default: require('./src/plugin/index.js').default,

  // New CMS functionality
  cms: require('./src/cms/index.js'),
};