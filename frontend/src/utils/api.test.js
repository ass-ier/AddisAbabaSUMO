import { api, toQuery, BASE_API } from "./api";

const originalFetch = global.fetch;

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(global, "fetch");
  sessionStorage.clear();
});

afterEach(() => {
  jest.useRealTimers();
  global.fetch.mockRestore?.();
});

function mockFetchOnce({ ok = true, status = 200, statusText = "OK", headers = { "content-type": "application/json" }, body = {} }) {
  global.fetch.mockResolvedValueOnce({
    ok,
    status,
    statusText,
    headers: { get: (k) => headers[k] },
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  });
}

describe("api utils", () => {
  test("toQuery builds query string and skips invalids", () => {
    const qs = toQuery({ a: 1, b: undefined, c: null, d: "", e: "undefined", f: "null", g: "ok" });
    expect(qs).toBe("a=1&g=ok");
  });

  test("GET with auth header when token present", async () => {
    sessionStorage.setItem("token", "abc");
    mockFetchOnce({ body: { users: [] } });
    const res = await api.listUsers();
    expect(res).toEqual({ users: [] });
    expect(global.fetch).toHaveBeenCalledWith(`${BASE_API}/api/users`, expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer abc" }) }));
  });

  test("jsonHeaders include content-type and auth", async () => {
    sessionStorage.setItem("token", "tkn");
    mockFetchOnce({ body: { ok: true } });
    await api.updateCurrentUser({ name: "n" });
    const [, init] = global.fetch.mock.calls[0];
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.headers.Authorization).toBe("Bearer tkn");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ name: "n" });
  });

  test("handles non-ok JSON error with different keys", async () => {
    mockFetchOnce({ ok: false, status: 400, statusText: "Bad", body: { message: "boom" } });
    await expect(api.getSettings()).rejects.toThrow(/boom/);
    mockFetchOnce({ ok: false, status: 400, statusText: "Bad", body: { error: "err" } });
    await expect(api.getSettings()).rejects.toThrow(/err/);
    mockFetchOnce({ ok: false, status: 400, statusText: "Bad", body: { errors: "errs" } });
    await expect(api.getSettings()).rejects.toThrow(/errs/);
    mockFetchOnce({ ok: false, status: 400, statusText: "Bad", body: { msg: "msg" } });
    await expect(api.getSettings()).rejects.toThrow(/msg/);
  });

  test("handles non-ok non-JSON error", async () => {
    mockFetchOnce({ ok: false, status: 500, statusText: "Err", headers: { "content-type": "text/plain" }, body: "nope" });
    await expect(api.getSettings()).rejects.toThrow(/nope/);
  });

  test("rejects when content-type not json and body not parsable", async () => {
    mockFetchOnce({ ok: true, headers: { "content-type": "text/plain" }, body: "not-json" });
    await expect(api.getSettings()).rejects.toThrow(/Expected JSON/);
  });

  test("query helpers used in endpoints", async () => {
    sessionStorage.setItem("token", "t");
    mockFetchOnce({ body: { items: [] } });
    await api.getKpis({ from: 1, to: 2, empty: "" });
    expect(global.fetch.mock.calls[0][0]).toMatch(/\?from=1&to=2$/);
  });
});