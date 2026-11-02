import React from 'react';
import { createRoot } from 'react-dom/client';
import Library from './Library';
import './style.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><Library /></React.StrictMode>);
