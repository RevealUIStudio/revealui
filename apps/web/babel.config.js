/**
 * Babel configuration for React Compiler
 * Enables compile-time optimizations for React components
 */

module.exports = {
  plugins: [
    [
      "babel-plugin-react-compiler",
      {
        // React Compiler options
        // See: https://react.dev/learn/react-compiler
      },
    ],
  ],
};

