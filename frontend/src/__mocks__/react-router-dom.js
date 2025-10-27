// Manual Jest mock for react-router-dom to allow rendering without dependency
const React = require('react');

module.exports = {
  BrowserRouter: ({ children }) => React.createElement('div', null, children),
  Routes: ({ children }) => React.createElement('div', null, 'Routes', children),
  Route: () => null,
  Navigate: () => React.createElement('div', null, 'Navigate'),
  useLocation: () => ({ pathname: '/' }),
  Link: ({ children }) => React.createElement('a', null, children),
};
