import { test, expect } from 'bun:test';
import { normalizeIssueIdentifier } from '../../src/lib/api.ts';

test('plain identifier passes through', () => {
  expect(normalizeIssueIdentifier('ENG-123')).toBe('ENG-123');
});

test('plain identifier trims whitespace', () => {
  expect(normalizeIssueIdentifier('  ENG-123  ')).toBe('ENG-123');
});

test('URL without slug', () => {
  expect(normalizeIssueIdentifier('https://linear.app/acme/issue/ENG-123')).toBe('ENG-123');
});

test('URL with slug', () => {
  expect(normalizeIssueIdentifier('https://linear.app/acme/issue/ENG-123/some-title')).toBe('ENG-123');
});

test('URL with query params', () => {
  expect(normalizeIssueIdentifier('https://linear.app/acme/issue/ENG-123?foo=bar')).toBe('ENG-123');
});

test('UUID passthrough', () => {
  expect(normalizeIssueIdentifier('c650d32a-125e-4cb7-83b4-b57cc2d457f2')).toBe(
    'c650d32a-125e-4cb7-83b4-b57cc2d457f2'
  );
});

test('HTTP URL (non-https)', () => {
  expect(normalizeIssueIdentifier('http://linear.app/acme/issue/ENG-123/title')).toBe('ENG-123');
});

test('URL without protocol', () => {
  expect(normalizeIssueIdentifier('linear.app/acme/issue/ENG-123/some-title')).toBe('ENG-123');
});

test('URL without protocol and no slug', () => {
  expect(normalizeIssueIdentifier('linear.app/acme/issue/DOW-1')).toBe('DOW-1');
});

test('www URL', () => {
  expect(normalizeIssueIdentifier('https://www.linear.app/acme/issue/ENG-123/title')).toBe('ENG-123');
});

test('www URL without protocol', () => {
  expect(normalizeIssueIdentifier('www.linear.app/acme/issue/ENG-123/title')).toBe('ENG-123');
});

test('URL trims whitespace', () => {
  expect(normalizeIssueIdentifier('  https://www.linear.app/acme/issue/ENG-123/title  ')).toBe('ENG-123');
});
