#!/usr/bin/env node
/*
  Generate a lightweight TLS phases XML by extracting <tlLogic> blocks
  from the SUMO network file into public/Sumoconfigs/tls_phases.xml
*/
const fs = require('fs');
const path = require('path');

function main() {
  const netXmlPath = path.resolve(__dirname, '..', 'public', 'Sumoconfigs', 'AddisAbaba.net.xml');
  const outPath = path.resolve(__dirname, '..', 'public', 'Sumoconfigs', 'tls_phases.xml');

  if (!fs.existsSync(netXmlPath)) {
    console.error(`Net XML not found at ${netXmlPath}`);
    process.exit(1);
  }

  const xml = fs.readFileSync(netXmlPath, 'utf8');

  // Extract all <tlLogic ...> ... </tlLogic> blocks (non-greedy across newlines)
  const tlLogicRegex = /<tlLogic\b[\s\S]*?<\/tlLogic>/g;
  const matches = xml.match(tlLogicRegex) || [];

  if (matches.length === 0) {
    console.error('No <tlLogic> blocks found in net XML.');
    process.exit(2);
  }

  const header = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  const additionalOpen = `<additional xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://sumo.dlr.de/xsd/additional_file.xsd">`;
  const additionalClose = `</additional>\n`;

  const body = matches.join('\n');
  const output = [header, additionalOpen, body, additionalClose].join('\n');

  fs.writeFileSync(outPath, output, 'utf8');

  console.log(`Wrote ${matches.length} tlLogic blocks to ${outPath}`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error('Failed to generate tls_phases.xml:', err && err.message ? err.message : err);
    process.exit(3);
  }
}
