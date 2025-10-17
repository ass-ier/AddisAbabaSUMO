/*
 OpenAPI 3.0 specification for AddisAbaba SUMO Traffic Management API
 This spec intentionally documents the major routes exposed by the three-tier backend.
*/

const pkg = { name: 'traffic-management-backend', version: '1.0.0' };

const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'AddisAbaba SUMO Traffic Management API',
    version: pkg.version,
    description:
      'REST API for authentication, users, traffic data, settings, audits, reporting, operator tools, and SUMO/TLS control.',
    contact: { name: 'Project Team' }
  },
  servers: [
    { url: '/', description: 'Root server (health, non-prefixed routes)' },
    { url: '/api', description: 'Primary API base path' }
  ],
  tags: [
    { name: 'Auth' },
    { name: 'OTP' },
    { name: 'Users' },
    { name: 'Traffic' },
    { name: 'Settings' },
    { name: 'Emergencies' },
    { name: 'Audit' },
    { name: 'Stats & Reports' },
    { name: 'Operator' },
    { name: 'SUMO' },
    { name: 'TLS' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      },
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'access_token'
      }
    },
    schemas: {
      LoginRequest: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', example: 'admin' },
          password: { type: 'string', example: 'secret' }
        }
      },
      RegisterRequest: {
        type: 'object',
        required: ['username', 'password', 'role'],
        properties: {
          username: { type: 'string' },
          password: { type: 'string' },
          role: { type: 'string', example: 'super_admin' },
          email: { type: 'string' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          region: { type: 'string' }
        }
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          username: { type: 'string' },
          role: { type: 'string' },
          region: { type: 'string' }
        }
      },
      TrafficData: {
        type: 'object',
        properties: {
          timestamp: { type: 'string', format: 'date-time' },
          intersectionId: { type: 'string' },
          trafficFlow: { type: 'number' },
          vehicleCount: { type: 'number' },
          averageSpeed: { type: 'number' },
          signalStatus: { type: 'string' }
        }
      }
    }
  },
  security: [{ bearerAuth: [] }],
  paths: {
    // Health (root)
    '/health': {
      get: {
        tags: ['Stats & Reports'],
        summary: 'Health check',
        responses: { '200': { description: 'Healthy' } }
      }
    },

    // Auth
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } }
        },
        responses: { '200': { description: 'OK (returns token and user)' }, '400': { description: 'Invalid credentials' } }
      }
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } }
        },
        responses: { '201': { description: 'Created' }, '400': { description: 'Validation error' } }
      }
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: { '200': { description: 'Logged out' }, '401': { description: 'Unauthorized' } }
      }
    },
    '/auth/verify': {
      get: { tags: ['Auth'], summary: 'Verify token', security: [{ bearerAuth: [] }, { cookieAuth: [] }], responses: { '200': { description: 'OK' } } }
    },
    '/auth/validate': {
      get: { tags: ['Auth'], summary: 'Validate token', security: [{ bearerAuth: [] }, { cookieAuth: [] }], responses: { '200': { description: 'OK' } } }
    },
    '/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Reset password using verified OTP',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '200': { description: 'Password reset' } }
      }
    },

    // OTP
    '/otp/send': { post: { tags: ['OTP'], summary: 'Send OTP', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'Sent' } } } },
    '/otp/verify': { post: { tags: ['OTP'], summary: 'Verify OTP', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'Verified' } } } },
    '/otp/resend': { post: { tags: ['OTP'], summary: 'Resend OTP', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'Resent' } } } },
    '/otp/check-verification': { post: { tags: ['OTP'], summary: 'Check verification', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'OK' } } } },

    // Users
    '/users/me': {
      get: { tags: ['Users'], summary: 'Get my profile', responses: { '200': { description: 'OK' } } },
      put: { tags: ['Users'], summary: 'Update my profile', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'Updated' } } }
    },
    '/users/team': { get: { tags: ['Users'], summary: 'Get team members', responses: { '200': { description: 'OK' } } } },
    '/users/count': { get: { tags: ['Users'], summary: 'Get user count', responses: { '200': { description: 'OK' } } } },
    '/users/stats/overview': { get: { tags: ['Users'], summary: 'Get user stats overview', responses: { '200': { description: 'OK' } } } },
    '/users/role/{role}': { get: { tags: ['Users'], summary: 'List users by role', parameters: [{ name: 'role', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
    '/users': {
      get: { tags: ['Users'], summary: 'List users', responses: { '200': { description: 'OK' } } },
      post: { tags: ['Users'], summary: 'Create user', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '201': { description: 'Created' } } }
    },
    '/users/{id}': {
      get: { tags: ['Users'], summary: 'Get user by ID', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' }, '404': { description: 'Not found' } } },
      put: { tags: ['Users'], summary: 'Update user', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'Updated' } } },
      delete: { tags: ['Users'], summary: 'Delete user', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Deleted' } } }
    },

    // Traffic
    '/traffic-data': {
      get: { tags: ['Traffic'], summary: 'Query traffic data', parameters: [{ name: 'intersectionId', in: 'query', schema: { type: 'string' } }, { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date-time' } }, { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date-time' } }, { name: 'limit', in: 'query', schema: { type: 'integer', default: 100 } }], responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/TrafficData' } } } } } } },
      post: { tags: ['Traffic'], summary: 'Create traffic data', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TrafficData' } } } }, responses: { '201': { description: 'Created' } } }
    },
    '/traffic-data/export.csv': { get: { tags: ['Traffic'], summary: 'Export traffic data CSV', responses: { '200': { description: 'CSV' } } } },
    '/traffic-data/stats': { get: { tags: ['Traffic'], summary: 'Traffic statistics', responses: { '200': { description: 'OK' } } } },

    // Settings
    '/settings': {
      get: { tags: ['Settings'], summary: 'Get settings', responses: { '200': { description: 'OK' } } },
      put: { tags: ['Settings'], summary: 'Update settings', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'Updated' } } }
    },

    // Emergencies
    '/emergencies': {
      get: { tags: ['Emergencies'], summary: 'List active emergencies', responses: { '200': { description: 'OK' } } },
      post: { tags: ['Emergencies'], summary: 'Create emergency', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '201': { description: 'Created' } } }
    },
    '/emergencies/{id}/force-clear': {
      post: { tags: ['Emergencies'], summary: 'Force clear emergency', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Cleared' } } }
    },

    // Audit
    '/audit': { get: { tags: ['Audit'], summary: 'List audit logs', parameters: [{ name: 'user', in: 'query', schema: { type: 'string' } }, { name: 'role', in: 'query', schema: { type: 'string' } }, { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date-time' } }, { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date-time' } }, { name: 'limit', in: 'query', schema: { type: 'integer', default: 200 } }], responses: { '200': { description: 'OK' } } } },
    '/audit/export.csv': { get: { tags: ['Audit'], summary: 'Export audit CSV', responses: { '200': { description: 'CSV' } } } },

    // Reports & Stats
    '/reports/kpis': { get: { tags: ['Stats & Reports'], summary: 'KPIs', responses: { '200': { description: 'OK' } } } },
    '/reports/trends': { get: { tags: ['Stats & Reports'], summary: 'Trends', responses: { '200': { description: 'OK' } } } },
    '/stats/overview': { get: { tags: ['Stats & Reports'], summary: 'System overview', responses: { '200': { description: 'OK' } } } },
    '/stats/admin': { get: { tags: ['Stats & Reports'], summary: 'Admin stats', responses: { '200': { description: 'OK' } } } },

    // Operator
    '/operator/dashboard': { get: { tags: ['Operator'], summary: 'Operator dashboard', responses: { '200': { description: 'OK' } } } },
    '/operator/traffic/overview': { get: { tags: ['Operator'], summary: 'Traffic overview', responses: { '200': { description: 'OK' } } } },
    '/operator/emergencies': { get: { tags: ['Operator'], summary: 'Operator emergencies', responses: { '200': { description: 'OK' } } } },
    '/operator/activity/summary': { get: { tags: ['Operator'], summary: 'Activity summary', parameters: [{ name: 'period', in: 'query', schema: { type: 'string', enum: ['1h','24h','7d','30d'] } }], responses: { '200': { description: 'OK' } } } },
    '/operator/system/health': { get: { tags: ['Operator'], summary: 'System health', responses: { '200': { description: 'OK' } } } },
    '/operator/system/metrics': { get: { tags: ['Operator'], summary: 'System metrics', parameters: [{ name: 'period', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 168 } }], responses: { '200': { description: 'OK' } } } },
    '/operator/system/metrics/export': { get: { tags: ['Operator'], summary: 'Export system metrics', parameters: [{ name: 'startDate', in: 'query', schema: { type: 'string', format: 'date-time' } }, { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date-time' } }], responses: { '200': { description: 'CSV' } } } },
    '/operator/system/config': { get: { tags: ['Operator'], summary: 'System config', responses: { '200': { description: 'OK' } } } },
    '/operator/system/monitoring/{action}': { post: { tags: ['Operator'], summary: 'Control system monitoring', parameters: [{ name: 'action', in: 'path', required: true, schema: { type: 'string', enum: ['start','stop'] } }], requestBody: { required: false, content: { 'application/json': { schema: { type: 'object', properties: { interval: { type: 'integer', minimum: 5000, maximum: 300000 } } } } } }, responses: { '200': { description: 'OK' } } } },
    '/operator/performance/stats': { get: { tags: ['Operator'], summary: 'Performance stats', parameters: [{ name: 'period', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 168 } }], responses: { '200': { description: 'OK' } } } },
    '/operator/traffic/analytics': { get: { tags: ['Operator'], summary: 'Traffic analytics', parameters: [{ name: 'timeRange', in: 'query', schema: { type: 'string', enum: ['1h','24h','7d','30d'] } }], responses: { '200': { description: 'OK' } } } },
    '/operator/traffic/intersection/{intersectionId}': { get: { tags: ['Operator'], summary: 'Intersection analysis', parameters: [{ name: 'intersectionId', in: 'path', required: true, schema: { type: 'string' } }, { name: 'timeRange', in: 'query', schema: { type: 'string', enum: ['1h','24h','7d','30d'] } }], responses: { '200': { description: 'OK' } } } },
    '/operator/alerts': { get: { tags: ['Operator'], summary: 'Alerts', parameters: [{ name: 'severity', in: 'query', schema: { type: 'string', enum: ['critical','warning','info'] } }, { name: 'source', in: 'query', schema: { type: 'string', enum: ['system','traffic','sumo'] } }, { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } }], responses: { '200': { description: 'OK' } } } },
    '/operator/reports/generate': { post: { tags: ['Operator'], summary: 'Generate report', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { type: { type: 'string', enum: ['daily','performance','system'] }, options: { type: 'object' } }, required: ['type'] } } } }, responses: { '200': { description: 'OK' } } } },
    '/operator/commands/execute': { post: { tags: ['Operator'], summary: 'Execute operator command', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { command: { type: 'string', enum: ['refresh_metrics','clear_cache','generate_diagnostics'] }, parameters: { type: 'object' } }, required: ['command'] } } } }, responses: { '200': { description: 'OK' } } } },
    '/operator/users/statistics': { get: { tags: ['Operator'], summary: 'User statistics', responses: { '200': { description: 'OK' } } } },
    '/operator/users/session': { get: { tags: ['Operator'], summary: 'Session info', responses: { '200': { description: 'OK' } } } },
    '/operator/users/operators': { get: { tags: ['Operator'], summary: 'List operators', parameters: [{ name: 'includeInactive', in: 'query', schema: { type: 'boolean' } }], responses: { '200': { description: 'OK' } } } },
    '/operator/users/admins': { get: { tags: ['Operator'], summary: 'List admins', parameters: [{ name: 'includeInactive', in: 'query', schema: { type: 'boolean' } }], responses: { '200': { description: 'OK' } } } },
    '/operator/users/privileged': { get: { tags: ['Operator'], summary: 'List privileged users', parameters: [{ name: 'includeInactive', in: 'query', schema: { type: 'boolean' } }], responses: { '200': { description: 'OK' } } } },
    '/operator/users/{userId}/role': { put: { tags: ['Operator'], summary: 'Update user role', parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { role: { type: 'string', enum: ['user','system_operator','admin'] } }, required: ['role'] } } } }, responses: { '200': { description: 'Updated' } } } },
    '/operator/users/{userId}/deactivate': { put: { tags: ['Operator'], summary: 'Deactivate user', parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Deactivated' } } } },
    '/operator/users/{userId}/activate': { put: { tags: ['Operator'], summary: 'Activate user', parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Activated' } } } },
    '/operator/users/{userId}/audit': { get: { tags: ['Operator'], summary: 'User audit trail', parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }, { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } }, { name: 'skip', in: 'query', schema: { type: 'integer', minimum: 0 } }], responses: { '200': { description: 'OK' } } } },

    // SUMO & TLS
    '/bridge/health': { get: { tags: ['SUMO'], summary: 'Bridge health (internal)', responses: { '200': { description: 'OK' } } } },
    '/bridge/test-frame': { post: { tags: ['SUMO'], summary: 'Inject test frame', requestBody: { required: false, content: { 'application/json': { schema: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, count: { type: 'integer' }, spread: { type: 'number' }, speed: { type: 'number' } } } } } }, responses: { '200': { description: 'Injected' } } } },

    '/sumo/status': { get: { tags: ['SUMO'], summary: 'Get simulation status', responses: { '200': { description: 'OK' } } } },
    '/sumo/configs': { get: { tags: ['SUMO'], summary: 'List SUMO configs', responses: { '200': { description: 'OK' } } } },
    '/sumo/config': { put: { tags: ['SUMO'], summary: 'Set SUMO config', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } } } }, responses: { '200': { description: 'OK' } } } },
    '/sumo/control': { post: { tags: ['SUMO'], summary: 'Control SUMO simulation', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { command: { type: 'string', enum: ['start_simulation','stop_simulation'] }, parameters: { type: 'object' } }, required: ['command'] } } } }, responses: { '200': { description: 'OK' } } } },

    '/tls/available': { get: { tags: ['TLS'], summary: 'TLS IDs and mappings', responses: { '200': { description: 'OK' } } } },
    '/tls/set-state': { post: { tags: ['TLS'], summary: 'Set TLS state', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { tls_id: { type: 'string' }, phase: { type: 'string' } }, required: ['tls_id','phase'] } } } }, responses: { '200': { description: 'OK' } } } },
    '/tls/phase-control': { post: { tags: ['TLS'], summary: 'TLS phase control', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { tls_id: { type: 'string' }, action: { type: 'string', enum: ['next','prev','set','resume','reset'] }, phaseIndex: { type: 'integer' } }, required: ['tls_id','action'] } } } }, responses: { '200': { description: 'OK' } } } }
  }
};

module.exports = openapi;