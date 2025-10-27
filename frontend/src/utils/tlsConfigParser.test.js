import { parseTlsConfigurations, parsePhaseStateToDirections, getAvailablePhases, isValidPhaseIndex } from "./tlsConfigParser";

describe("tlsConfigParser", () => {
  const sampleXml = `<?xml version="1.0"?>
  <net>
    <tlLogic id="J1" type="static" programID="0" offset="5">
      <phase duration="30" state="GGgrrryy" />
      <phase duration="5"  state="yyyrrrrr" />
      <phase duration="25" state="rrrGGGrr" />
    </tlLogic>
    <tlLogic id="J2" type="actuated" programID="A">
      <phase duration="10" state="rrrr" />
    </tlLogic>
  </net>`;

  test("parses XML and phases", () => {
    const cfg = parseTlsConfigurations(sampleXml);
    expect(Object.keys(cfg)).toEqual(["J1", "J2"]);
    expect(cfg.J1.programs["0"].offset).toBe(5);
    expect(cfg.J1.programs["0"].phases).toHaveLength(3);
    expect(cfg.J1.programs["0"].phases[0]).toEqual(
      expect.objectContaining({ index: 0, duration: 30, state: "GGgrrryy", description: expect.any(String) })
    );
    expect(cfg.J2.programs["A"].phases[0].state).toBe("rrrr");
  });

  test("throws on parse error", () => {
    expect(() => parseTlsConfigurations("<not-xml>")).toThrow(/Failed to parse XML/);
  });

  test("parsePhaseStateToDirections maps for 12, 8, 4 and fallback", () => {
    const d12 = parsePhaseStateToDirections("gyrgyrgyrgyr");
    expect(d12.N).toEqual(expect.objectContaining({ L: expect.any(String), S: expect.any(String), R: expect.any(String) }));
    const d8 = parsePhaseStateToDirections("ggrryyrr");
    expect(d8.N.S).toBeDefined();
    const d4 = parsePhaseStateToDirections("gyor");
    expect(d4.W.S).toBeDefined();
    const fb = parsePhaseStateToDirections("");
    expect(fb.N.L).toBe("r");
  });

  test("getAvailablePhases and isValidPhaseIndex", () => {
    const cfg = parseTlsConfigurations(sampleXml);
    expect(getAvailablePhases("J1", cfg, "0")).toHaveLength(3);
    expect(getAvailablePhases("X", cfg)).toEqual([]);
    expect(isValidPhaseIndex("J1", 2, cfg, "0")).toBe(true);
    expect(isValidPhaseIndex("J1", 3, cfg, "0")).toBe(false);
  });
});