import { render } from "@testing-library/react";
import React from "react";
import LoadingSpinner from "./LoadingSpinner.jsx";

test("LoadingSpinner renders message", () => {
  const { getByText } = render(<LoadingSpinner size="sm" message="Loading page..." />);
  expect(getByText(/Loading page/i)).toBeInTheDocument();
});
