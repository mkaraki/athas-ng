import { Decoration, EditorView } from "@codemirror/view";

/** Keep opaque active-line backgrounds from covering drawn selections. */
export const athasActiveLine = EditorView.decorations.compute(["selection", "doc"], (state) => {
  const lines = new Set<number>();
  for (const range of state.selection.ranges) {
    if (!range.empty) return Decoration.none;
    lines.add(state.doc.lineAt(range.head).from);
  }
  return Decoration.set(
    [...lines].map((from) => Decoration.line({ class: "cm-activeLine" }).range(from)),
    true,
  );
});
