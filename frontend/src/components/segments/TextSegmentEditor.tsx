import { useEffect, useRef, useState, type ReactNode } from 'react';
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { emptyRichTextDoc } from '../../domain/lesson';
import type { RichTextDoc, TextSegment } from '../../domain/types';
import { useLessonStore } from '../../stores/lessonStore';
import { Icon } from '../ui/Icons';
import { SegmentHeader } from './SegmentHeader';

const COMMIT_DELAY_MS = 350;

/**
 * Rich-text segment editor. StarterKit is narrowed to the allowed set:
 * bold, italic, headings, lists, and links — nothing else.
 */
export function TextSegmentEditor({ segment }: { segment: TextSegment }) {
  const updateSegment = useLessonStore((state) => state.updateSegment);
  const [focused, setFocused] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkHref, setLinkHref] = useState('');

  const pending = useRef<RichTextDoc | null>(null);
  const lastCommitted = useRef<RichTextDoc | null | undefined>(undefined);
  const timer = useRef<number | undefined>(undefined);

  const flush = () => {
    if (!pending.current) return;
    window.clearTimeout(timer.current);
    lastCommitted.current = pending.current;
    updateSegment(segment.id, { content: pending.current });
    pending.current = null;
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;

  const editor = useEditor({
    immediatelyRender: true,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, linkOnPaste: true },
      }),
      Placeholder.configure({
        placeholder: 'Write the lesson text…',
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: (segment.content ?? emptyRichTextDoc()) as unknown as JSONContent,
    editorProps: {
      attributes: {
        class: 'lesson-editor',
        'aria-label': 'Lesson text',
      },
    },
    onUpdate: ({ editor: instance }) => {
      pending.current = instance.getJSON() as unknown as RichTextDoc;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => flushRef.current(), COMMIT_DELAY_MS);
    },
  });

  // Flush debounced edits when the segment closes.
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
      flushRef.current();
    },
    [],
  );

  // Reflect external changes (undo/redo) into the editor without clobbering typing.
  useEffect(() => {
    if (!editor) return;
    const incoming = segment.content;
    if (lastCommitted.current === incoming) return;
    const currentJson = editor.getJSON();
    if (JSON.stringify(currentJson) !== JSON.stringify(incoming)) {
      editor.commands.setContent((incoming ?? emptyRichTextDoc()) as unknown as JSONContent, {
        emitUpdate: false,
      });
    }
  }, [editor, segment.content]);

  const openLinkEditor = () => {
    if (!editor) return;
    setLinkHref((editor.getAttributes('link')['href'] as string | undefined) ?? '');
    setLinkOpen(true);
  };

  const applyLink = () => {
    if (!editor) return;
    const raw = linkHref.trim();
    if (!raw) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      const href = /^[a-zA-Z][\w+.-]*:/.test(raw) ? raw : `https://${raw}`;
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
    setLinkOpen(false);
  };

  const ToolButton = ({
    active,
    label,
    onClick,
    children,
  }: {
    active?: boolean;
    label: string;
    onClick: () => void;
    children: ReactNode;
  }) => (
    <button
      type="button"
      className={`icon-btn ${active ? 'btn-active text-primary' : ''}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SegmentHeader segment={segment} />
      <div className="min-h-0 flex-1 overflow-y-auto bg-page">
        <div className="mx-auto w-full max-w-3xl px-6 py-8">
          <div
            className="card overflow-hidden bg-page"
            onFocus={() => setFocused(true)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setFocused(false);
                setLinkOpen(false);
                flush();
              }
            }}
          >
            <div
              className={`flex items-center gap-0.5 border-b border-default px-2 transition-opacity ${
                focused ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
              aria-hidden={!focused}
            >
              <div className="relative flex items-center gap-0.5">
                <ToolButton
                  label="Bold"
                  active={editor.isActive('bold')}
                  onClick={() => editor.chain().focus().toggleBold().run()}
                >
                  <Icon name="bold" size={15} />
                </ToolButton>
                <ToolButton
                  label="Italic"
                  active={editor.isActive('italic')}
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                >
                  <Icon name="italic" size={15} />
                </ToolButton>
                <span className="mx-1 h-4 w-px bg-default" aria-hidden="true" />
                <ToolButton
                  label="Heading 2"
                  active={editor.isActive('heading', { level: 2 })}
                  onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                >
                  <span className="text-xs font-semibold">H2</span>
                </ToolButton>
                <ToolButton
                  label="Heading 3"
                  active={editor.isActive('heading', { level: 3 })}
                  onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                >
                  <span className="text-xs font-semibold">H3</span>
                </ToolButton>
                <span className="mx-1 h-4 w-px bg-default" aria-hidden="true" />
                <ToolButton
                  label="Bullet list"
                  active={editor.isActive('bulletList')}
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                >
                  <Icon name="list" size={15} />
                </ToolButton>
                <ToolButton
                  label="Numbered list"
                  active={editor.isActive('orderedList')}
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                >
                  <Icon name="list-ordered" size={15} />
                </ToolButton>
                <span className="mx-1 h-4 w-px bg-default" aria-hidden="true" />
                <ToolButton label="Link" active={editor.isActive('link')} onClick={openLinkEditor}>
                  <Icon name="link" size={15} />
                </ToolButton>

                {linkOpen && (
                  <div className="absolute left-0 top-9 z-20 w-72 rounded-md border border-default bg-elevated p-2 shadow-lg">
                    <label className="label" htmlFor="link-url">
                      Link URL
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        id="link-url"
                        className="input h-8"
                        value={linkHref}
                        placeholder="https://…"
                        autoFocus
                        onChange={(event) => setLinkHref(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            applyLink();
                          }
                          if (event.key === 'Escape') setLinkOpen(false);
                        }}
                      />
                      <button type="button" className="btn btn-primary btn-sm" onClick={applyLink}>
                        Apply
                      </button>
                    </div>
                    <p className="mt-1.5 text-[11px] text-secondary">Leave empty to remove the link.</p>
                  </div>
                )}
              </div>

              <div className="ml-auto pr-1 text-[11px] text-secondary">Lesson text · Merriweather</div>
            </div>

            <EditorContent editor={editor} />
          </div>

          <p className="mt-3 text-xs text-secondary">
            Formatting is limited to bold, italic, headings, lists, and links. This prose is part of the lesson flow.
          </p>
        </div>
      </div>
    </div>
  );
}
