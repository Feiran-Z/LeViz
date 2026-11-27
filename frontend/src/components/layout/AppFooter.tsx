const LICENSE_URL = 'https://github.com/Feiran-Z/LeViz/blob/main/LICENSE';
const SOURCE_URL = 'https://github.com/Feiran-Z/LeViz';
const NOTICES_PATH = 'licenses/THIRD_PARTY_NOTICES.txt';

function FooterLinks() {
  const noticesUrl = `${import.meta.env.BASE_URL}${NOTICES_PATH}`;
  return (
    <>
      <a href={LICENSE_URL} target="_blank" rel="noreferrer" className="hover:text-primary">
        MIT License
      </a>
      <a href={noticesUrl} target="_blank" rel="noreferrer" className="hover:text-primary">
        Third-party notices
      </a>
      <a href={SOURCE_URL} target="_blank" rel="noreferrer" className="hover:text-primary">
        Source
      </a>
    </>
  );
}

/**
 * Copyright and license line. The page variant sits below the lesson list and
 * is pinned to the bottom of short pages; the document variant is compact and
 * prints with the lesson overview.
 */
export function AppFooter({ variant = 'page' }: { variant?: 'page' | 'document' }) {
  const year = new Date().getFullYear();
  const content = (
    <>
      <p>© {year} Feiran Zhang</p>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <FooterLinks />
      </p>
    </>
  );

  if (variant === 'document') {
    return (
      <footer className="mt-8 border-t border-default pt-3 text-[11px] text-secondary">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">{content}</div>
      </footer>
    );
  }

  return (
    <footer className="mt-auto border-t border-default">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-4 text-[11px] text-secondary">
        {content}
      </div>
    </footer>
  );
}
