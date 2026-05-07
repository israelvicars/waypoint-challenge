import { describe, it, expect } from 'vitest';
import { readIEP, readLesson } from '../src/utils/file_reader.js';

describe('readIEP', () => {
  it('reads jasmine-bailey IEP', () => {
    const content = readIEP('jasmine-bailey');
    expect(content.length).toBeGreaterThan(100);
    expect(content).toContain('Jasmine');
  });

  it('reads marcus-chen IEP', () => {
    const content = readIEP('marcus-chen');
    expect(content.length).toBeGreaterThan(100);
    expect(content).toContain('Marcus');
  });

  it('throws on unknown student ID', () => {
    expect(() => readIEP('nobody')).toThrow(/Unknown student ID/);
  });
});

describe('readLesson', () => {
  it('reads what-is-community lesson', () => {
    const content = readLesson('what-is-community');
    expect(content.length).toBeGreaterThan(100);
    expect(content).toContain('community');
  });

  it('throws on unknown lesson ID', () => {
    expect(() => readLesson('nope')).toThrow(/Unknown lesson ID/);
  });
});
