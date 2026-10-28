export interface NoteBlock {
  kind: "heading" | "paragraph" | "list" | "image";
  text?: string;
  level?: number;
  id?: string;
  items?: string[];
  src?: string;
  caption?: string;
}
// Deliberately limited to the repository's release-note format. No HTML is executed.
export function parseChangelog(markdown: string): NoteBlock[] {
  const lines = markdown.replace(/^\uFEFF/, "").split(/\r?\n/),
    blocks: NoteBlock[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === "# Changelog") continue;
    const heading = /^(#{2,4}) (.+)$/.exec(line);
    if (heading) {
      blocks.push({
        kind: "heading",
        level: heading[1].length,
        text: heading[2],
        id: "note-" + blocks.length,
      });
      continue;
    }
    const image =
      /^!\[([^\]]*)\]\((docs\/changelog\/assets\/[a-zA-Z0-9_./-]+\.png)\)$/.exec(
        line,
      );
    if (image && !image[2].split("/").includes("..")) {
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      const caption =
        j < lines.length && !/^(#|- |!\[)/.test(lines[j])
          ? lines[j].trim()
          : "";
      blocks.push({
        kind: "image",
        text: image[1],
        src: "/" + image[2],
        caption,
      });
      if (caption) i = j;
      continue;
    }
    if (line.startsWith("- ")) {
      const items = [line.slice(2)];
      while (lines[i + 1]?.startsWith("- ")) items.push(lines[++i].slice(2));
      blocks.push({ kind: "list", items });
      continue;
    }
    const text = [line];
    while (lines[i + 1]?.trim() && !/^(#|- |!\[)/.test(lines[i + 1]))
      text.push(lines[++i].trim());
    blocks.push({ kind: "paragraph", text: text.join(" ") });
  }
  return blocks;
}
