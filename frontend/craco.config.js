module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Remove ESLint plugin completely
      webpackConfig.plugins = webpackConfig.plugins.filter(
        (plugin) => plugin.constructor.name !== 'ESLintWebpackPlugin'
      );

      // Add WASM support
      webpackConfig.experiments = {
        ...webpackConfig.experiments,
        asyncWebAssembly: true,
      };

      // Ensure wasm-pack output is treated as a binary asset that JS glue will fetch
      // (do NOT let webpack compile the .wasm as a native WebAssembly module)
      webpackConfig.module.rules.push({
        test: /\.wasm$/,
        type: 'asset/resource',
      });

      return webpackConfig;
    },
  },
};
