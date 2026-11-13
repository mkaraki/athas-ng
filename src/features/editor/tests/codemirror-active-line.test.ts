// @vitest-environment jsdom
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { athasActiveLine } from "../engines/codemirror/active-line";

let view: EditorView | undefined;

afterEach(() => {
  view?.destroy();
  view = undefined;
});

describe("active-line selection priority", () => {
  function createView() {
    view = new EditorView({
      state: EditorState.create({
        doc: "abcd\nefgh\nijkl",
        extensions: [EditorState.allowMultipleSelections.of(true), athasActiveLine],
      }),
    });
    return view;
  }

  it.each([
    [EditorSelection.range(0, 2)],
    [EditorSelection.range(0, 5)],
    [EditorSelection.range(0, 2), EditorSelection.range(5, 7), EditorSelection.range(10, 12)],
    [EditorSelection.cursor(0), EditorSelection.range(5, 7)],
  ])("does not paint over a selection and restores the cursor line afterward", (...ranges) => {
    const editor = createView();
    expect(editor.dom.querySelectorAll(".cm-activeLine")).toHaveLength(1);

    editor.dispatch({ selection: EditorSelection.create(ranges) });
    expect(editor.dom.querySelectorAll(".cm-activeLine")).toHaveLength(0);

    editor.dispatch({ selection: { anchor: 5 } });
    expect(editor.dom.querySelectorAll(".cm-activeLine")).toHaveLength(1);
    expect(editor.dom.querySelector(".cm-activeLine")?.textContent).toBe("efgh");
  });

  it("highlights each distinct cursor line and follows document edits", () => {
    const editor = createView();
    editor.dispatch({
      selection: EditorSelection.create([
        EditorSelection.cursor(0),
        EditorSelection.cursor(2),
        EditorSelection.cursor(5),
      ]),
    });
    expect(editor.dom.querySelectorAll(".cm-activeLine")).toHaveLength(2);
    editor.dispatch({ changes: { from: 0, insert: "new\n" } });
    expect(
      [...editor.dom.querySelectorAll(".cm-activeLine")].map((line) => line.textContent),
    ).toEqual(["new", "abcd", "efgh"]);
  });
});
