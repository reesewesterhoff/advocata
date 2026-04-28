import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FormField } from "./form-field";

describe("FormField", () => {
  describe("label", () => {
    it("renders the label text", () => {
      render(
        <FormField id="email" label="Email Address">
          <input id="email" />
        </FormField>,
      );

      expect(screen.getByText("Email Address")).toBeInTheDocument();
    });

    it("associates the label with the control via htmlFor", () => {
      render(
        <FormField id="email" label="Email Address">
          <input id="email" />
        </FormField>,
      );

      expect(screen.getByLabelText("Email Address")).toBeInTheDocument();
    });
  });

  describe("children", () => {
    it("renders a single child control", () => {
      render(
        <FormField id="name" label="Name">
          <input id="name" placeholder="Enter name" />
        </FormField>,
      );

      expect(screen.getByPlaceholderText("Enter name")).toBeInTheDocument();
    });

    it("renders multiple children", () => {
      render(
        <FormField id="bio" label="Bio">
          <textarea id="bio" placeholder="Enter bio" />
          <p>0/200</p>
        </FormField>,
      );

      expect(screen.getByPlaceholderText("Enter bio")).toBeInTheDocument();
      expect(screen.getByText("0/200")).toBeInTheDocument();
    });
  });

  describe("error", () => {
    it("renders nothing for the error when error is undefined", () => {
      render(
        <FormField id="name" label="Name">
          <input id="name" />
        </FormField>,
      );

      expect(screen.queryByText("Name is required.")).not.toBeInTheDocument();
    });

    it("renders the error message when error is provided", () => {
      render(
        <FormField id="name" label="Name" error="Name is required.">
          <input id="name" />
        </FormField>,
      );

      expect(screen.getByText("Name is required.")).toBeInTheDocument();
    });

    it("renders the error message after the children", () => {
      render(
        <FormField id="name" label="Name" error="Name is required.">
          <input id="name" />
        </FormField>,
      );

      const input = screen.getByRole("textbox");
      const error = screen.getByText("Name is required.");

      expect(input.compareDocumentPosition(error)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    });
  });
});
