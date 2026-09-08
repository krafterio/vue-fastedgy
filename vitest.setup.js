/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { setDefaultBaseUrl } from './plugins/fetcher.js';

// The application sets this from its own environment; the package's tests need
// a base to resolve a URL against, and nothing more.
setDefaultBaseUrl('/api');
