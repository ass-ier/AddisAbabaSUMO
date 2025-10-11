/**
 * Traffic Light Configuration Parser
 * Parses SUMO .net.xml files to extract traffic light definitions and phases
 */

/**
 * Parse traffic light configurations from XML content
 * @param {string} xmlContent - The XML content of the .net.xml file
 * @returns {Object} - Object containing TLS configurations keyed by ID
 */
export const parseTlsConfigurations = (xmlContent) => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
  
  // Check for parsing errors
  const parseError = xmlDoc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Failed to parse XML: ' + parseError.textContent);
  }

  const tlsConfigs = {};
  
  // Find all tlLogic elements
  const tlLogicElements = xmlDoc.querySelectorAll('tlLogic');
  
  tlLogicElements.forEach(tlLogic => {
    const id = tlLogic.getAttribute('id');
    const type = tlLogic.getAttribute('type');
    const programID = tlLogic.getAttribute('programID') || '0';
    const offset = tlLogic.getAttribute('offset') || '0';
    
    if (!id) return;
    
    // Initialize TLS config if not exists
    if (!tlsConfigs[id]) {
      tlsConfigs[id] = {
        id,
        programs: {}
      };
    }
    
    // Parse phases for this program
    const phases = [];
    const phaseElements = tlLogic.querySelectorAll('phase');
    
    phaseElements.forEach((phase, index) => {
      const duration = parseFloat(phase.getAttribute('duration')) || 0;
      const state = phase.getAttribute('state') || '';
      const minDur = parseFloat(phase.getAttribute('minDur')) || null;
      const maxDur = parseFloat(phase.getAttribute('maxDur')) || null;
      
      phases.push({
        index,
        duration,
        state,
        minDur,
        maxDur,
        description: generatePhaseDescription(state)
      });
    });
    
    tlsConfigs[id].programs[programID] = {
      type,
      offset: parseFloat(offset),
      phases
    };
  });
  
  return tlsConfigs;
};

/**
 * Generate a human-readable description of a phase state
 * @param {string} state - The phase state string (e.g., "GGGrrrYYY")
 * @returns {string} - Human-readable description
 */
const generatePhaseDescription = (state) => {
  if (!state) return 'Unknown';
  
  const greenCount = (state.match(/G/g) || []).length;
  const redCount = (state.match(/r/g) || []).length;
  const yellowCount = (state.match(/y/g) || []).length;
  
  if (greenCount > redCount && greenCount > yellowCount) {
    return 'Main flow';
  } else if (yellowCount > 0) {
    return 'Transition';
  } else if (redCount === state.length) {
    return 'All stop';
  } else {
    return 'Mixed';
  }
};

/**
 * Parse phase state string into directional signals
 * Assumes a standard 4-way intersection with 3 movements per approach
 * @param {string} state - The phase state string
 * @returns {Object} - Object with directional signal states
 */
export const parsePhaseStateToDirections = (state) => {
  if (!state || state.length < 4) {
    return {
      N: { L: 'r', S: 'r', R: 'r' },
      E: { L: 'r', S: 'r', R: 'r' },
      S: { L: 'r', S: 'r', R: 'r' },
      W: { L: 'r', S: 'r', R: 'r' }
    };
  }
  
  // For complex intersections, we'll try to map the state string to movements
  // This is a simplified mapping - real implementations would need intersection-specific logic
  const directions = {
    N: { L: 'r', S: 'r', R: 'r' },
    E: { L: 'r', S: 'r', R: 'r' },
    S: { L: 'r', S: 'r', R: 'r' },
    W: { L: 'r', S: 'r', R: 'r' }
  };
  
  // Simple mapping for common patterns
  const chars = state.toLowerCase().split('');
  
  // Try to detect patterns - this is intersection-specific but we'll use heuristics
  if (chars.length >= 12) {
    // Assume 12-signal layout: N(L,S,R), E(L,S,R), S(L,S,R), W(L,S,R)
    directions.N.L = chars[0] || 'r';
    directions.N.S = chars[1] || 'r';
    directions.N.R = chars[2] || 'r';
    directions.E.L = chars[3] || 'r';
    directions.E.S = chars[4] || 'r';
    directions.E.R = chars[5] || 'r';
    directions.S.L = chars[6] || 'r';
    directions.S.S = chars[7] || 'r';
    directions.S.R = chars[8] || 'r';
    directions.W.L = chars[9] || 'r';
    directions.W.S = chars[10] || 'r';
    directions.W.R = chars[11] || 'r';
  } else if (chars.length >= 8) {
    // Assume 8-signal layout: N(S,L), E(S,L), S(S,L), W(S,L)
    directions.N.S = chars[0] || 'r';
    directions.N.L = chars[1] || 'r';
    directions.E.S = chars[2] || 'r';
    directions.E.L = chars[3] || 'r';
    directions.S.S = chars[4] || 'r';
    directions.S.L = chars[5] || 'r';
    directions.W.S = chars[6] || 'r';
    directions.W.L = chars[7] || 'r';
  } else if (chars.length >= 4) {
    // Simple 4-signal layout: N, E, S, W (straight only)
    directions.N.S = chars[0] || 'r';
    directions.E.S = chars[1] || 'r';
    directions.S.S = chars[2] || 'r';
    directions.W.S = chars[3] || 'r';
  }
  
  return directions;
};

/**
 * Load and parse TLS configurations from the public .net.xml file
 * @returns {Promise<Object>} - Promise resolving to TLS configurations
 */
export const loadTlsConfigurations = async () => {
  try {
    console.log('Loading TLS configurations from /Sumoconfigs/AddisAbaba.net.xml');
    const response = await fetch('/Sumoconfigs/AddisAbaba.net.xml');
    
    if (!response.ok) {
      console.error(`HTTP Error: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to load .net.xml: ${response.status} ${response.statusText}`);
    }
    
    console.log('XML file loaded successfully, parsing content...');
    const xmlContent = await response.text();
    
    if (!xmlContent || xmlContent.trim().length === 0) {
      throw new Error('XML file is empty or invalid');
    }
    
    const configs = parseTlsConfigurations(xmlContent);
    console.log('TLS configurations parsed successfully:', Object.keys(configs).length, 'traffic lights found');
    return configs;
  } catch (error) {
    console.error('Error loading TLS configurations:', error);
    // Return empty config as fallback instead of throwing
    return {};
  }
};

/**
 * Get available phases for a specific traffic light
 * @param {string} tlsId - Traffic light ID
 * @param {Object} tlsConfigs - TLS configurations object
 * @param {string} programId - Program ID (default: '0')
 * @returns {Array} - Array of available phases
 */
export const getAvailablePhases = (tlsId, tlsConfigs, programId = '0') => {
  if (!tlsConfigs[tlsId] || !tlsConfigs[tlsId].programs[programId]) {
    return [];
  }
  
  return tlsConfigs[tlsId].programs[programId].phases || [];
};

/**
 * Validate if a phase index is valid for a traffic light
 * @param {string} tlsId - Traffic light ID
 * @param {number} phaseIndex - Phase index to validate
 * @param {Object} tlsConfigs - TLS configurations object
 * @param {string} programId - Program ID (default: '0')
 * @returns {boolean} - Whether the phase index is valid
 */
export const isValidPhaseIndex = (tlsId, phaseIndex, tlsConfigs, programId = '0') => {
  const phases = getAvailablePhases(tlsId, tlsConfigs, programId);
  return phaseIndex >= 0 && phaseIndex < phases.length;
};