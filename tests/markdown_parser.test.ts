import { describe, it, expect } from 'vitest';
import { readIEP } from '../src/utils/file_reader.js';
import {
  extractKeyProfileSummary,
  extractGoal,
  extractAccommodations,
  getFullDocument,
} from '../src/utils/markdown_parser.js';

describe('extractKeyProfileSummary', () => {
  it('extracts non-empty KPS from jasmine-bailey (with MCP Reference suffix)', () => {
    const kps = extractKeyProfileSummary(readIEP('jasmine-bailey'));
    expect(kps.length).toBeGreaterThan(50);
    // KPS contains instructionally relevant summary content
    expect(kps).toMatch(/Reading|ELA|goal|accommodation/i);
  });

  it('extracts non-empty KPS from marcus-chen', () => {
    const kps = extractKeyProfileSummary(readIEP('marcus-chen'));
    expect(kps.length).toBeGreaterThan(50);
    expect(kps).toMatch(/Reading|fluency|goal|accommodation/i);
  });

  it('does not bleed into subsequent sections', () => {
    const kps = extractKeyProfileSummary(readIEP('jasmine-bailey'));
    // Should not contain content from unrelated sections
    expect(kps).not.toContain('## Notice');
    expect(kps).not.toContain('## Administrative');
  });
});

describe('extractGoal', () => {
  it('extracts Goal 1 from jasmine-bailey', () => {
    const goal = extractGoal(readIEP('jasmine-bailey'), 1);
    expect(goal.length).toBeGreaterThan(20);
    expect(goal).toContain('Goal 1');
  });

  it('extracts Goal 3 (ELA/Reading) from jasmine-bailey', () => {
    const goal = extractGoal(readIEP('jasmine-bailey'), 3);
    expect(goal).toContain('Goal 3');
    expect(goal).toMatch(/ELA|Reading|Comprehension/i);
  });

  it('extracts Goal 1 from marcus-chen', () => {
    const goal = extractGoal(readIEP('marcus-chen'), 1);
    expect(goal).toContain('Goal 1');
    expect(goal).toMatch(/Reading|Fluency/i);
  });

  it('returns empty string for nonexistent goal number', () => {
    const goal = extractGoal(readIEP('jasmine-bailey'), 99);
    expect(goal).toBe('');
  });
});

describe('extractAccommodations', () => {
  it('extracts accommodations from jasmine-bailey', () => {
    const acc = extractAccommodations(readIEP('jasmine-bailey'));
    expect(acc.length).toBeGreaterThan(20);
    expect(acc).toContain('Accommodations');
  });

  it('extracts accommodations from marcus-chen', () => {
    const acc = extractAccommodations(readIEP('marcus-chen'));
    expect(acc.length).toBeGreaterThan(20);
    expect(acc).toContain('Accommodations');
  });
});

describe('getFullDocument', () => {
  it('returns the full markdown unchanged', () => {
    const raw = readIEP('jasmine-bailey');
    expect(getFullDocument(raw)).toBe(raw);
  });
});
