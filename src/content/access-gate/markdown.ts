// Tiny markdown link renderer for server-supplied messages (kill-switch
// reasons today; potentially other ops messages later).
//
// Supports only [text](url) inline links. URLs must start with http:// or
// https://; anything else falls through as plain text. We never set
// innerHTML — every node is created via document.createElement /
// createTextNode — so a malicious server response can't smuggle script
// tags or event handlers into the page.
export function renderInlineMarkdown(parent: HTMLElement, text: string): void {
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = linkRe.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parent.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
    }
    const linkText = match[1];
    const url = match[2];
    if (/^https?:\/\//i.test(url)) {
      const a = document.createElement("a");
      a.href = url;
      a.textContent = linkText;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      parent.appendChild(a);
    } else {
      parent.appendChild(document.createTextNode(match[0]));
    }
    lastIdx = linkRe.lastIndex;
  }
  if (lastIdx < text.length) {
    parent.appendChild(document.createTextNode(text.slice(lastIdx)));
  }
}
