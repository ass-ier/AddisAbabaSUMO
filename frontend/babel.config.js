module.exports = function (api) {
  const isTest = api && api.env && api.env('test');
  return {
    presets: [
      [
        '@babel/preset-env',
        {
          targets: { node: 'current' },
        },
      ],
      ['@babel/preset-react', { runtime: 'automatic' }],
    ],
    plugins: [
      // Only include this plugin outside of Jest to avoid requiring it in test env
      ...(isTest ? [] : ['babel-plugin-transform-import-meta']),
    ],
  };
};
