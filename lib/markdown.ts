export function renderMarkdown(md: string): string {
  if (!md) return '';
  let html = md;

  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const lines = html.split('\n');
  const result: string[] = [];
  let inList = false;
  let listType: 'ul' | 'ol' | null = null;

  for (const line of lines) {
    const ulMatch = /^\s*[-*]\s+(.*)$/.exec(line);
    const olMatch = /^\s*\d+\.\s+(.*)$/.exec(line);
    const quote = /^\s*>\s?(.*)$/.exec(line);

    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        if (inList) result.push(`</${listType}>`);
        result.push('<ul>');
        inList = true;
        listType = 'ul';
      }
      result.push(`<li>${inline(ulMatch[1])}</li>`);
    } else if (olMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) result.push(`</${listType}>`);
        result.push('<ol>');
        inList = true;
        listType = 'ol';
      }
      result.push(`<li>${inline(olMatch[1])}</li>`);
    } else if (quote) {
      if (inList) { result.push(`</${listType}>`); inList = false; listType = null; }
      result.push(`<blockquote>${inline(quote[1])}</blockquote>`);
    } else {
      if (inList) { result.push(`</${listType}>`); inList = false; listType = null; }
      if (line.trim() === '') {
        result.push('<br />');
      } else {
        result.push(`<p>${inline(line)}</p>`);
      }
    }
  }
  if (inList && listType) result.push(`</${listType}>`);

  return result.join('\n');
}

function inline(text: string): string {
  let t = text;
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  return t;
}
