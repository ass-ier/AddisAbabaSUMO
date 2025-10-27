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
  jest: {
    configure: (jestConfig) => {
      // Add HTML reporter and HTML coverage
      jestConfig.reporters = [
        'default',
        [
          'jest-html-reporters',
          {
            publicPath: '<rootDir>/tests-report',
            filename: 'report.html',
            expand: true,
            openReport: false,
          },
        ],
      ];
      jestConfig.setupFilesAfterEnv = ['<rootDir>/src/setupTests.js'];
      jestConfig.testEnvironment = 'jsdom';
      jestConfig.transform = {
        '^.+\\.[jt]sx?$': 'babel-jest',
      };
      jestConfig.transformIgnorePatterns = [
        'node_modules/(?!(axios|react-router|react-router-dom)/)'
      ];
      jestConfig.collectCoverage = true;
      jestConfig.coverageReporters = ['json', 'lcov', 'text', 'clover', 'html'];
      // Collect coverage from all app sources
      jestConfig.collectCoverageFrom = [
        '<rootDir>/src/**/*.{js,jsx}',
        '!<rootDir>/src/**/__mocks__/**',
        '!<rootDir>/src/wasm-parser/**',
        '!<rootDir>/src/utils/sumoNetParser.js',
        '!<rootDir>/src/workers/**',
      ];
      jestConfig.coveragePathIgnorePatterns = [
        '/node_modules/',
      ];
      // Stub style imports
      jestConfig.moduleNameMapper = {
        ...(jestConfig.moduleNameMapper || {}),
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
      };
      return jestConfig;
    },
  },
};
