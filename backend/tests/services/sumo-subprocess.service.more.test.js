jest.mock('child_process', () => ({ spawn: jest.fn(() => ({
  pid: 123,
  stdout: { on: jest.fn() },
  stderr: { on: jest.fn() },
  on: jest.fn(),
  stdin: { write: jest.fn().mockReturnValue(true), flush: jest.fn() },
  kill: jest.fn()
})) }));

const fs = require('fs');
jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
  // Pretend cfg and bridge exist, but no RL model
  if (String(p).endsWith('sumo_bridge.py')) return true;
  if (String(p).endsWith('.sumocfg') || String(p).endsWith('.net.xml') || String(p).endsWith('.xml')) return true;
  if (String(p).includes('best_model.zip')) return false;
  return true;
});

const svc = require('../../src/services/sumo-subprocess.service');

describe('SumoSubprocessService additional branches', () => {
  test('spawn with RL options throws when model missing', () => {
    expect(() => svc.spawn({ cfgPath: __filename, startWithGui:false, stepLength:1, rlOptions:{ modelPath:'missing.zip', delta: 10 }, onData:()=>{}, onError:()=>{}, onExit:()=>{} })).toThrow('RL requested');
  });

  test('getProcessInfo returns null when no process', () => {
    expect(svc.getProcessInfo()).toBeNull();
  });
});