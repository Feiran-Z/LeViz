import { describe, expect, it } from 'vitest';
import indexHtml from '../index.html?raw';

describe('index.html', () => {
  it('asks crawlers not to index the preview site', () => {
    expect(indexHtml).toMatch(/<meta\s+name="robots"\s+content="noindex"/i);
  });
});
