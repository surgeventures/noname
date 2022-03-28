import assert from 'assert';

import type { APIOperationTemplateOptions } from './types';
import parseOperation, { CACHE_OPTIONS } from './operations';
import { JSONValue } from '@fresha/noname-core';

describe('app/utils/operConfig', () => {
  describe('parseOperation', () => {
    it('should not use caching by default', () => {
      assert.equal((parseOperation('list') as APIOperationTemplateOptions).cache, null);
      assert.equal((parseOperation('read') as APIOperationTemplateOptions).cache, null);
      assert.equal((parseOperation('single-read') as APIOperationTemplateOptions).cache, null);
      assert.equal((parseOperation('create') as APIOperationTemplateOptions).cache, null);
    });

    it('cache=true for GETs should use default cache settings', () => {
      assert.deepEqual(
        (parseOperation(['list', { cache: true }]) as APIOperationTemplateOptions).cache,
        CACHE_OPTIONS,
      );
      assert.deepEqual(
        (parseOperation(['read', { cache: true }]) as APIOperationTemplateOptions).cache,
        CACHE_OPTIONS,
      );
      assert.deepEqual(
        (parseOperation(['single-read', { cache: true }]) as APIOperationTemplateOptions).cache,
        CACHE_OPTIONS,
      );
    });

    it('cache=true for non-GETs should not use cache anyway', () => {
      assert.deepEqual(
        (parseOperation(['create', { cache: true }]) as APIOperationTemplateOptions).cache,
        null,
      );
      assert.deepEqual(
        (parseOperation(['update', { cache: true }]) as APIOperationTemplateOptions).cache,
        null,
      );
      assert.deepEqual(
        (parseOperation(['single-update', { cache: true }]) as APIOperationTemplateOptions).cache,
        null,
      );
    });

    it('cache=Number should set expiration time', () => {
      assert.deepEqual(
        (parseOperation(['read', { cache: 3600 }]) as APIOperationTemplateOptions).cache,
        {
          ...CACHE_OPTIONS,
          expirationTime: 3600,
        },
      );
    });

    it('should be possible to override cache parameters', () => {
      const makeKey = (action: string, url: string, params?: JSONValue) =>
        `${action}:${url}:${String(params)}`;
      assert.deepEqual(
        (
          parseOperation([
            'single-read',
            {
              cache: {
                expirationTime: 600,
                size: 20,
                makeKey,
              },
            },
          ]) as APIOperationTemplateOptions
        ).cache,
        {
          expirationTime: 600,
          size: 20,
          makeKey,
        },
      );
    });
  });
});
