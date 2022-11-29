import assert from 'assert';

import type {
  APIAction,
  APICache,
  APICaller,
  APICallerResponse,
  APICommonConfig,
  APIEntryConfig,
} from './types';

import { configureActions } from './index';

describe('api/factory', () => {
  describe('apiCall', () => {
    // here one should place tests related with calling to server API
    // using new mechanism
  });

  describe('configureActions', () => {
    it('should throw on unknown action type', () => {
      assert.throws(() => {
        configureActions(
          '',
          {
            room: {
              url: 'a',
              operations: ['errorneous'],
            },
          } as unknown as APIEntryConfig,
          { rootUrl: 'b' } as APICommonConfig,
          {} as { apiCaller: APICaller; entryCache: APICache },
        );
      });
    });

    function assertActionPropsEqual(
      action: APIAction,
      { apiName }: { key?: string; apiName: string },
    ) {
      assert(typeof action === 'function', 'action should be a function');
      assert.equal(action.apiName, apiName, 'apiName should be the same as action name');
    }

    const mockedApiCaller: APICaller = () => Promise.resolve({}) as Promise<APICallerResponse>;
    it('should recognize the "list" operation shortcut', () => {
      const actions = configureActions(
        'user',
        {
          url: 'user',
          operations: ['list'],
        },
        { rootUrl: '/api', adapter: 'jsonapi' },
        { apiCaller: mockedApiCaller, entryCache: {} },
      );
      assert.deepEqual(Object.keys(actions), ['readUserList'], 'should create only one action');
      assertActionPropsEqual(actions.readUserList, {
        key: 'user',
        apiName: 'readUserList',
      });
    });

    it('should recognize the "create" operation shortcut', () => {
      const { createUser } = configureActions(
        'user',
        {
          url: 'user',
          operations: ['create'],
        },
        { rootUrl: '/api', adapter: 'jsonapi' },
        { apiCaller: mockedApiCaller, entryCache: {} },
      );
      assertActionPropsEqual(createUser, {
        apiName: 'createUser',
      });
    });

    it('should recognize the "read" operation shortcut', () => {
      const { readPermission } = configureActions(
        'permission',
        {
          url: 'perm',
          operations: ['read'],
        },
        { rootUrl: 'api-root', adapter: 'jsonapi' },
        { apiCaller: mockedApiCaller, entryCache: {} },
      );
      assertActionPropsEqual(readPermission, {
        apiName: 'readPermission',
      });
    });

    it('should recognize the "update" operation shortcut', () => {
      const { updateBooking } = configureActions(
        'booking',
        {
          url: 'booking/update',
          operations: ['update'],
        },
        { rootUrl: '', adapter: 'jsonapi' },
        { apiCaller: mockedApiCaller, entryCache: {} },
      );
      assertActionPropsEqual(updateBooking, {
        apiName: 'updateBooking',
      });
    });

    it('should recognize the "delete" operation shortcut', () => {
      const { deleteClient } = configureActions(
        'client',
        {
          url: 'garbage',
          operations: ['delete'],
        },
        { rootUrl: 'v2', adapter: 'jsonapi' },
        { apiCaller: mockedApiCaller, entryCache: {} },
      );
      assertActionPropsEqual(deleteClient, {
        apiName: 'deleteClient',
      });
    });

    it('should recognize the "single-read" operation shortcut', () => {
      const { readProviderSettings } = configureActions(
        'providerSettings',
        {
          url: '/settings',
          operations: ['single-read'],
        },
        { rootUrl: 'v3', adapter: 'jsonapi' },
        { apiCaller: mockedApiCaller, entryCache: {} },
      );
      assertActionPropsEqual(readProviderSettings, {
        apiName: 'readProviderSettings',
      });
    });

    it('should throw on action name collision', () => {
      assert.throws(() => {
        configureActions(
          'settings',
          {
            url: '/settings',
            operations: ['read', 'single-read'],
          },
          { rootUrl: '/v5', adapter: 'jsonapi' },
          { apiCaller: mockedApiCaller, entryCache: {} },
        );
      });
    });

    it('should a separate action for each operation', () => {
      const actions = configureActions(
        'user',
        {
          url: 'user',
          operations: ['list', 'create'],
        },
        { rootUrl: 'v6', adapter: 'jsonapi' },
        { apiCaller: mockedApiCaller, entryCache: {} },
      );
      const actionNames = Object.keys(actions);
      actionNames.sort();
      assert.deepEqual(actionNames, ['createUser', 'readUserList']);
    });
  });

  // describe('configureApi', () => {});

  // describe('configureCompositeApi', () => {});
});
