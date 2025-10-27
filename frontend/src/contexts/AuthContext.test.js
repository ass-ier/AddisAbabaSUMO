import { render } from "@testing-library/react";
import React from "react";
import { AuthProvider, useAuth } from "../contexts/AuthContext";

function Consumer() {
  const { user, login, logout } = useAuth();
  return (
    <div>
      <div data-testid="user">{user ? user.username : "anon"}</div>
      <button
        onClick={async () => {
          await login("alice", "pw");
        }}
      >
        login
      </button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

test("AuthProvider initializes without token", () => {
  sessionStorage.clear();
  const { getByTestId } = render(
    <AuthProvider>
      <Consumer />
    </AuthProvider>
  );
  expect(getByTestId("user").textContent).toBe("anon");
});
