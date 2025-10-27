jest.mock('child_process', () => ({ spawn: jest.fn(() => ({
  pid: 123,
  stdout: { on: jest.fn() },
  stderr: { on: jest.fn() },
  on: jest.fn(),
  stdin: { write: jest.fn().mockReturnValue(true), flush: jest.fn() },
  kill: jest.fn()
})) }));

jest.mock('fs', () => ({ existsSync: jest.fn(() => true) }));

const { spawn } = require('child_process');
const svc = require('../../src/services/sumo-subprocess.service');

describe('SumoSubprocessService (lightweight)', () => {
  test('sendCommand returns false when not running', () => {
    expect(svc.sendCommand({ a:1 })).toBe(false);
  });

  test('spawn returns success and sets running', () => {
    const r = svc.spawn({ cfgPath: __filename, startWithGui:false, stepLength:1, onData:()=>{}, onError:()=>{}, onExit:()=>{} });
    expect(r.success).toBe(true);
    expect(svc.getIsRunning()).toBe(true);
    expect(spawn).toHaveBeenCalled();
  });

  test('kill clears process', () => {
    svc.kill();
    expect(svc.getIsRunning()).toBe(false);
  });
});