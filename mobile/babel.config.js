// babel-preset-expo, plus one fix: oRPC ships `async (...[input, options = {}]) =>`,
// a rest parameter with a pattern that Hermes refuses ("invalid destructuring
// target"). Only @orpc gets the parameters rewritten.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    overrides: [
      {
        // A function, not a RegExp: Metro loads this config once without a filename.
        test: (filename) => !!filename && /node_modules[\\/]@orpc[\\/]/.test(filename),
        plugins: [
          "@babel/plugin-transform-destructuring",
          "@babel/plugin-transform-parameters",
        ],
      },
    ],
  };
};
