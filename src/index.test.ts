import { describe, expect, it } from 'vitest';
import { VERSION } from './index.js';

describe('@ait-co/polyfill', () => {
  it('exports VERSION', () => {
    expect(VERSION).toBe('0.1.0');
  });
});
