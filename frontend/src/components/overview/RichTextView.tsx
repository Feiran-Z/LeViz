import type { ReactNode } from 'react';
import type { RichTextDoc, RichTextNode } from '../../domain/types';

function hasText(node: RichTextNode): boolean {
  if (node.type === 'text' && (node.text ?? '').length > 0) return true;
  return (node.content ?? []).some(hasText);
}

function renderText(node: RichTextNode, key: string): ReactNode {
  let content: ReactNode = node.text ?? '';
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') content = <strong>{content}</strong>;
    else if (mark.type === 'italic') content = <em>{content}</em>;
    else if (mark.type === 'link') {
      const href = typeof mark.attrs?.['href'] === 'string' ? mark.attrs['href'] : '#';
      content = (
        <a href={href} target="_blank" rel="noreferrer">
          {content}
        </a>
      );
    }
  }
  return <span key={key}>{content}</span>;
}

function renderNodes(nodes: RichTextNode[] | undefined, keyPrefix: string): ReactNode {
  if (!nodes || nodes.length === 0) return null;
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (node.type) {
      case 'paragraph':
        return <p key={key}>{renderNodes(node.content, key)}</p>;
      case 'heading': {
        const level = node.attrs?.['level'];
        const Tag = level === 1 ? 'h1' : level === 3 ? 'h3' : 'h2';
        return <Tag key={key}>{renderNodes(node.content, key)}</Tag>;
      }
      case 'bulletList':
        return <ul key={key}>{renderNodes(node.content, key)}</ul>;
      case 'orderedList':
        return <ol key={key}>{renderNodes(node.content, key)}</ol>;
      case 'listItem':
        return <li key={key}>{renderNodes(node.content, key)}</li>;
      case 'hardBreak':
        return <br key={key} />;
      case 'text':
        return renderText(node, key);
      default:
        return node.content ? (
          <div key={key}>{renderNodes(node.content, key)}</div>
        ) : node.text ? (
          renderText(node, key)
        ) : null;
    }
  });
}

/** Read-only renderer for the limited rich-text set (paragraphs, headings, lists, links). */
export function RichTextView({ doc }: { doc: RichTextDoc | null }) {
  if (!doc || !doc.content || !doc.content.some(hasText)) {
    return <p className="text-sm text-secondary">No text yet.</p>;
  }
  return <div className="lesson-prose">{renderNodes(doc.content, 'doc')}</div>;
}
