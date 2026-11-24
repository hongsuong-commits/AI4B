import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import App from '../App.jsx';

describe('App rendering test', () => {
  it('renders App without crashing', () => {
    global.localStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    };
    global.window = {
      location: { origin: 'http://localhost:5173' }
    };
    global.document = {
      hidden: false,
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    const html = renderToString(<App />);
    expect(html).toBeDefined();
    expect(html.length).toBeGreaterThan(100);
  });
});
