/**
 * StateManager Tests
 * 
 * Tests for the StateManager class covering all acceptance criteria:
 * - Central state object with nested structure
 * - Path-based state access (dot notation)
 * - setState/getState methods
 * - State validation and type checking
 * - State change notifications via EventBus
 * - Reactive state updates (Task 1.2.2)
 *   - Subscription system for state changes
 *   - Selective updates (only notify relevant subscribers)
 *   - Batch update support
 *   - State rollback functionality
 *   - State comparison and diff detection
 */

const EventBus = require('../../src/core/EventBus');
const StateManager = require('../../src/core/StateManager');

describe('StateManager', () => {
    let stateManager;
    let eventBus;

    beforeEach(() => {
        eventBus = new EventBus();
        stateManager = new StateManager(eventBus);
    });

    afterEach(() => {
        stateManager = null;
        eventBus = null;
    });

    describe('Initialization', () => {
        test('should initialize with default state structure', () => {
            const state = stateManager.getFullState();
            
            expect(state).toHaveProperty('characters');
            expect(state).toHaveProperty('activeCharacter');
            expect(state).toHaveProperty('chatSessions');
            expect(state).toHaveProperty('activeChat');
            expect(state).toHaveProperty('messages');
            expect(state).toHaveProperty('config');
            expect(state).toHaveProperty('ui');
            expect(state).toHaveProperty('runtime');
            
            expect(state.characters).toEqual({});
            expect(state.activeCharacter).toBeNull();
            expect(state.chatSessions).toEqual({});
            expect(state.activeChat).toBeNull();
            expect(state.messages).toEqual({});
            expect(state.config).toEqual({});
            expect(state.ui).toEqual({
                theme: 'default',
                sidebarOpen: true,
                loading: false
            });
            expect(state.runtime).toEqual({
                initialized: false,
                version: '1.0.0',
                lastUpdate: null
            });
        });

        test('should initialize without EventBus', () => {
            const stateManagerWithoutEventBus = new StateManager();
            expect(stateManagerWithoutEventBus.eventBus).toBeNull();
        });

        test('should initialize with EventBus', () => {
            expect(stateManager.eventBus).toBe(eventBus);
        });
    });

    describe('Path-based State Access', () => {
        test('should set and get simple state values', () => {
            stateManager.setState('ui.theme', 'dark');
            expect(stateManager.getState('ui.theme')).toBe('dark');
        });

        test('should set and get nested state values', () => {
            stateManager.setState('characters.test.id', 'char123');
            stateManager.setState('characters.test.name', 'Test Character');
            
            expect(stateManager.getState('characters.test.id')).toBe('char123');
            expect(stateManager.getState('characters.test.name')).toBe('Test Character');
        });

        test('should create nested objects automatically', () => {
            stateManager.setState('deeply.nested.property', 'value');
            
            expect(stateManager.getState('deeply.nested.property')).toBe('value');
            expect(stateManager.getState('deeply.nested')).toEqual({ property: 'value' });
        });

        test('should return default value for non-existent paths', () => {
            expect(stateManager.getState('nonexistent.path', 'default')).toBe('default');
            expect(stateManager.getState('nonexistent.path')).toBeUndefined();
        });

        test('should handle complex nested structures', () => {
            const complexData = {
                id: 'char123',
                name: 'Test Character',
                metadata: {
                    tags: ['fantasy', 'adventure'],
                    creator: 'Test Creator'
                }
            };
            
            stateManager.setState('characters.test', complexData);
            
            expect(stateManager.getState('characters.test')).toEqual(complexData);
            expect(stateManager.getState('characters.test.metadata.tags')).toEqual(['fantasy', 'adventure']);
            expect(stateManager.getState('characters.test.metadata.creator')).toBe('Test Creator');
        });
    });

    describe('State Validation', () => {
        test('should validate values with custom rules', () => {
            // Add validation rule for character names
            stateManager.addValidationRule('characters.*.name', (value) => {
                return typeof value === 'string' && value.length > 0;
            }, 'Character name must be a non-empty string');

            // Valid value should pass
            expect(() => {
                stateManager.setState('characters.test.name', 'Valid Name');
            }).not.toThrow();

            // Invalid value should throw
            expect(() => {
                stateManager.setState('characters.test.name', '');
            }).toThrow('Character name must be a non-empty string');

            expect(() => {
                stateManager.setState('characters.test.name', 123);
            }).toThrow('Character name must be a non-empty string');
        });

        test('should validate with wildcard patterns', () => {
            // Add validation rule for all character IDs
            stateManager.addValidationRule('characters.*.id', (value) => {
                return typeof value === 'string' && value.startsWith('char');
            });

            // Valid values should pass
            expect(() => {
                stateManager.setState('characters.char1.id', 'char123');
                stateManager.setState('characters.char2.id', 'char456');
            }).not.toThrow();

            // Invalid value should throw
            expect(() => {
                stateManager.setState('characters.char3.id', 'invalid123');
            }).toThrow();
        });

        test('should skip validation when validate option is false', () => {
            stateManager.addValidationRule('test.path', () => false, 'Always fails');

            // Should throw with validation
            expect(() => {
                stateManager.setState('test.path', 'value');
            }).toThrow();

            // Should not throw without validation
            expect(() => {
                stateManager.setState('test.path', 'value', { validate: false });
            }).not.toThrow();
        });

        test('should remove validation rules', () => {
            stateManager.addValidationRule('test.path', () => false);
            
            // Should throw initially
            expect(() => {
                stateManager.setState('test.path', 'value');
            }).toThrow();

            // Remove the rule
            stateManager.removeValidationRule('test.path');
            
            // Should not throw after removal
            expect(() => {
                stateManager.setState('test.path', 'value');
            }).not.toThrow();
        });
    });

    describe('State Change Notifications', () => {
        test('should notify subscribers of state changes', () => {
            const callback = jest.fn();
            stateManager.subscribe('ui.theme', callback);
            
            stateManager.setState('ui.theme', 'dark');
            
            expect(callback).toHaveBeenCalledWith('dark', 'default', 'ui.theme');
        });

        test('should notify multiple subscribers', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            
            stateManager.subscribe('ui.theme', callback1);
            stateManager.subscribe('ui.theme', callback2);
            
            stateManager.setState('ui.theme', 'dark');
            
            expect(callback1).toHaveBeenCalledWith('dark', 'default', 'ui.theme');
            expect(callback2).toHaveBeenCalledWith('dark', 'default', 'ui.theme');
        });

        test('should call immediate callback when requested', () => {
            const callback = jest.fn();
            stateManager.setState('ui.theme', 'dark');
            
            stateManager.subscribe('ui.theme', callback, { immediate: true });
            
            expect(callback).toHaveBeenCalledWith('dark', 'dark', 'ui.theme');
        });

        test('should unsubscribe from state changes', () => {
            const callback = jest.fn();
            const unsubscribe = stateManager.subscribe('ui.theme', callback);
            
            stateManager.setState('ui.theme', 'dark');
            expect(callback).toHaveBeenCalledTimes(1);
            
            unsubscribe();
            stateManager.setState('ui.theme', 'light');
            expect(callback).toHaveBeenCalledTimes(1); // Should not be called again
        });

        test('should unsubscribe specific callback', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            
            stateManager.subscribe('ui.theme', callback1);
            stateManager.subscribe('ui.theme', callback2);
            
            stateManager.unsubscribe('ui.theme', callback1);
            stateManager.setState('ui.theme', 'dark');
            
            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).toHaveBeenCalledWith('dark', 'default', 'ui.theme');
        });

        test('should emit EventBus events when EventBus is available', () => {
            const eventCallback = jest.fn();
            eventBus.subscribe('state:changed', eventCallback);
            
            stateManager.setState('ui.theme', 'dark');
            
            expect(eventCallback).toHaveBeenCalledWith({
                path: 'ui.theme',
                oldValue: 'default',
                newValue: 'dark',
                timestamp: expect.any(Number)
            });
        });

        test('should not emit events when silent option is used', () => {
            const callback = jest.fn();
            const eventCallback = jest.fn();
            
            stateManager.subscribe('ui.theme', callback);
            eventBus.subscribe('state:changed', eventCallback);
            
            stateManager.setState('ui.theme', 'dark', { silent: true });
            
            expect(callback).not.toHaveBeenCalled();
            expect(eventCallback).not.toHaveBeenCalled();
        });
    });

    describe('Reactive State Updates (Task 1.2.2)', () => {
        describe('Batch Update Support', () => {
            test('should support batch updates', async () => {
                const callback1 = jest.fn();
                const callback2 = jest.fn();
                const batchCallback = jest.fn();
                
                stateManager.subscribe('ui.theme', callback1);
                stateManager.subscribe('ui.sidebarOpen', callback2);
                eventBus.subscribe('state:batch', batchCallback);
                
                await stateManager.batchUpdate(() => {
                    stateManager.setState('ui.theme', 'dark');
                    stateManager.setState('ui.sidebarOpen', false);
                    stateManager.setState('ui.loading', true);
                });
                
                // Individual callbacks should be called
                expect(callback1).toHaveBeenCalledWith('dark', 'default', 'ui.theme');
                expect(callback2).toHaveBeenCalledWith(false, true, 'ui.sidebarOpen');
                
                // Batch event should be emitted
                expect(batchCallback).toHaveBeenCalledWith({
                    updates: expect.arrayContaining([
                        expect.objectContaining({ path: 'ui.theme', newValue: 'dark' }),
                        expect.objectContaining({ path: 'ui.sidebarOpen', newValue: false }),
                        expect.objectContaining({ path: 'ui.loading', newValue: true })
                    ]),
                    timestamp: expect.any(Number)
                });
                
                // State should be updated
                expect(stateManager.getState('ui.theme')).toBe('dark');
                expect(stateManager.getState('ui.sidebarOpen')).toBe(false);
                expect(stateManager.getState('ui.loading')).toBe(true);
            });

            test('should prevent nested batch updates', async () => {
                await expect(async () => {
                    await stateManager.batchUpdate(async () => {
                        await stateManager.batchUpdate(() => {});
                    });
                }).rejects.toThrow('StateManager: Already in batch mode');
            });

            test('should handle errors in batch updates', async () => {
                await expect(async () => {
                    await stateManager.batchUpdate(() => {
                        throw new Error('Batch error');
                    });
                }).rejects.toThrow('Batch error');
                
                // Batch mode should be cleared
                expect(stateManager.batchMode).toBe(false);
            });
        });

        describe('State Rollback Functionality', () => {
            test('should create checkpoints', () => {
                const checkpointId = stateManager.createCheckpoint('test-checkpoint');
                
                expect(checkpointId).toMatch(/^checkpoint_\d+_[a-z0-9]+$/);
                expect(stateManager.rollbackStack).toHaveLength(1);
                expect(stateManager.rollbackStack[0].label).toBe('test-checkpoint');
            });

            test('should rollback to previous state', () => {
                // Set initial state
                stateManager.setState('ui.theme', 'dark');
                stateManager.createCheckpoint('initial');
                
                // Make changes
                stateManager.setState('ui.theme', 'light');
                stateManager.setState('ui.sidebarOpen', false);
                
                // Rollback
                const success = stateManager.rollback(1);
                
                expect(success).toBe(true);
                expect(stateManager.getState('ui.theme')).toBe('dark');
                expect(stateManager.getState('ui.sidebarOpen')).toBe(true); // Back to default
            });

            test('should rollback by checkpoint ID', () => {
                stateManager.setState('ui.theme', 'dark');
                const checkpointId = stateManager.createCheckpoint('test');
                
                stateManager.setState('ui.theme', 'light');
                
                // Rollback using checkpoint ID
                const success = stateManager.rollback(checkpointId);
                
                expect(success).toBe(true);
                expect(stateManager.getState('ui.theme')).toBe('dark');
            });

            test('should rollback by checkpoint label', () => {
                stateManager.setState('ui.theme', 'dark');
                stateManager.createCheckpoint('test-label');
                
                stateManager.setState('ui.theme', 'light');
                
                // Rollback using label
                const success = stateManager.rollback('test-label');
                
                expect(success).toBe(true);
                expect(stateManager.getState('ui.theme')).toBe('dark');
            });

            test('should handle invalid rollback attempts', () => {
                expect(stateManager.rollback(1)).toBe(false);
                expect(stateManager.rollback(0)).toBe(false);
                expect(stateManager.rollback(-1)).toBe(false);
                expect(stateManager.rollback('nonexistent')).toBe(false);
            });

            test('should limit rollback stack size', () => {
                stateManager.maxRollbackStack = 2;
                
                stateManager.createCheckpoint('1');
                stateManager.createCheckpoint('2');
                stateManager.createCheckpoint('3');
                
                expect(stateManager.rollbackStack).toHaveLength(2);
                expect(stateManager.rollbackStack[0].label).toBe('2');
                expect(stateManager.rollbackStack[1].label).toBe('3');
            });
        });

        describe('State Comparison and Diff Detection', () => {
            test('should compute diff between states', () => {
                stateManager.setState('ui.theme', 'dark');
                stateManager.createCheckpoint('before');
                
                stateManager.setState('ui.theme', 'light');
                stateManager.setState('ui.sidebarOpen', false);
                stateManager.setState('new.property', 'value');
                
                const diff = stateManager.getDiff(1);
                
                expect(diff).toEqual({
                    added: {
                        'new': { 'property': 'value' }
                    },
                    modified: {
                        'ui.theme': { old: 'dark', new: 'light' },
                        'ui.sidebarOpen': { old: true, new: false }
                    },
                    removed: {}
                });
            });

            test('should compute diff between arbitrary states', () => {
                const state1 = { a: 1, b: { c: 2 } };
                const state2 = { a: 2, b: { c: 3, d: 4 }, e: 5 };
                
                const diff = stateManager.getDiffBetween(state1, state2);
                
                expect(diff).toEqual({
                    added: {
                        'b.d': 4,
                        'e': 5
                    },
                    modified: {
                        'a': { old: 1, new: 2 },
                        'b.c': { old: 2, new: 3 }
                    },
                    removed: {}
                });
            });

            test('should handle complex nested diffs', () => {
                const state1 = {
                    characters: {
                        char1: { name: 'Alice', tags: ['hero'] },
                        char2: { name: 'Bob', tags: ['villain'] }
                    }
                };
                
                const state2 = {
                    characters: {
                        char1: { name: 'Alice', tags: ['hero', 'leader'] },
                        char3: { name: 'Charlie', tags: ['neutral'] }
                    }
                };
                
                const diff = stateManager.getDiffBetween(state1, state2);
                
                expect(diff.added).toHaveProperty('characters.char3');
                expect(diff.modified).toHaveProperty('characters.char1.tags');
                expect(diff.removed).toHaveProperty('characters.char2');
                
                // Verify the actual structure
                expect(diff.added['characters.char3']).toEqual({ name: 'Charlie', tags: ['neutral'] });
                expect(diff.modified['characters.char1.tags']).toEqual({ old: ['hero'], new: ['hero', 'leader'] });
                expect(diff.removed['characters.char2']).toEqual({ name: 'Bob', tags: ['villain'] });
            });

            test('should return null for invalid diff targets', () => {
                expect(stateManager.getDiff('nonexistent')).toBeNull();
                expect(stateManager.getDiff(999)).toBeNull();
                expect(stateManager.getDiff(-1)).toBeNull();
            });
        });

        describe('Selective Updates with Filtering', () => {
            test('should subscribe with filter function', () => {
                const callback = jest.fn();
                
                const unsubscribe = stateManager.subscribeWithFilter(
                    'ui.theme',
                    callback,
                    {
                        filter: (newValue, oldValue) => newValue !== oldValue && newValue === 'dark'
                    }
                );
                
                // Should not trigger (same value)
                stateManager.setState('ui.theme', 'default');
                expect(callback).not.toHaveBeenCalled();
                
                // Should not trigger (filter condition not met)
                stateManager.setState('ui.theme', 'light');
                expect(callback).not.toHaveBeenCalled();
                
                // Should trigger (filter condition met)
                stateManager.setState('ui.theme', 'dark');
                expect(callback).toHaveBeenCalledWith('dark', 'light', 'ui.theme');
                
                unsubscribe();
            });

            test('should subscribe to multiple paths', () => {
                const callback = jest.fn();
                
                const unsubscribe = stateManager.subscribeWithFilter(
                    ['ui.theme', 'ui.sidebarOpen'],
                    callback
                );
                
                stateManager.setState('ui.theme', 'dark');
                stateManager.setState('ui.sidebarOpen', false);
                
                expect(callback).toHaveBeenCalledTimes(2);
                expect(callback).toHaveBeenCalledWith('dark', 'default', 'ui.theme');
                expect(callback).toHaveBeenCalledWith(false, true, 'ui.sidebarOpen');
                
                unsubscribe();
            });

            test('should unsubscribe from all paths', () => {
                const callback = jest.fn();
                
                const unsubscribe = stateManager.subscribeWithFilter(
                    ['ui.theme', 'ui.sidebarOpen'],
                    callback
                );
                
                unsubscribe();
                
                stateManager.setState('ui.theme', 'dark');
                stateManager.setState('ui.sidebarOpen', false);
                
                expect(callback).not.toHaveBeenCalled();
            });
        });
    });

    describe('State History', () => {
        test('should record state changes in history', () => {
            stateManager.setState('ui.theme', 'dark');
            stateManager.setState('ui.theme', 'light');
            
            const history = stateManager.getHistory();
            expect(history).toHaveLength(2);
            expect(history[0].path).toBe('ui.theme');
            expect(history[0].oldValue).toBe('default');
            expect(history[0].newValue).toBe('dark');
            expect(history[1].path).toBe('ui.theme');
            expect(history[1].oldValue).toBe('dark');
            expect(history[1].newValue).toBe('light');
        });

        test('should limit history size', () => {
            stateManager.maxHistorySize = 3;
            
            for (let i = 0; i < 5; i++) {
                stateManager.setState('test.value', i);
            }
            
            const history = stateManager.getHistory();
            expect(history).toHaveLength(3);
            expect(history[0].newValue).toBe(2);
            expect(history[1].newValue).toBe(3);
            expect(history[2].newValue).toBe(4);
        });

        test('should clear history', () => {
            stateManager.setState('test.value', 'value');
            expect(stateManager.getHistory()).toHaveLength(1);
            
            stateManager.clearHistory();
            expect(stateManager.getHistory()).toHaveLength(0);
        });

        test('should record batch changes in history', async () => {
            await stateManager.batchUpdate(() => {
                stateManager.setState('ui.theme', 'dark');
                stateManager.setState('ui.sidebarOpen', false);
            });
            
            const history = stateManager.getHistory();
            expect(history).toHaveLength(1);
            expect(history[0].type).toBe('batch');
            expect(history[0].updates).toHaveLength(2);
        });
    });

    describe('State Reset', () => {
        test('should reset to default state', () => {
            stateManager.setState('ui.theme', 'dark');
            stateManager.setState('characters.test', { name: 'Test' });
            
            stateManager.reset();
            
            expect(stateManager.getState('ui.theme')).toBe('default');
            expect(stateManager.getState('characters.test')).toBeUndefined();
        });

        test('should reset to custom state', () => {
            const customState = {
                ui: { theme: 'custom' },
                characters: { test: { name: 'Custom' } }
            };
            
            stateManager.reset(customState);
            
            expect(stateManager.getState('ui.theme')).toBe('custom');
            expect(stateManager.getState('characters.test.name')).toBe('Custom');
        });

        test('should clear history on reset', () => {
            stateManager.setState('test.value', 'value');
            expect(stateManager.getHistory()).toHaveLength(1);
            
            stateManager.reset();
            expect(stateManager.getHistory()).toHaveLength(0);
        });
    });

    describe('Error Handling', () => {
        test('should throw error for invalid path in setState', () => {
            expect(() => {
                stateManager.setState('', 'value');
            }).toThrow('StateManager: Path must be a non-empty string');

            expect(() => {
                stateManager.setState(null, 'value');
            }).toThrow('StateManager: Path must be a non-empty string');

            expect(() => {
                stateManager.setState(123, 'value');
            }).toThrow('StateManager: Path must be a non-empty string');
        });

        test('should throw error for invalid path in getState', () => {
            expect(() => {
                stateManager.getState('');
            }).toThrow('StateManager: Path must be a non-empty string');

            expect(() => {
                stateManager.getState(null);
            }).toThrow('StateManager: Path must be a non-empty string');
        });

        test('should throw error for invalid callback in subscribe', () => {
            expect(() => {
                stateManager.subscribe('test.path', 'not a function');
            }).toThrow('StateManager: Callback must be a function');

            expect(() => {
                stateManager.subscribe('test.path', null);
            }).toThrow('StateManager: Callback must be a function');
        });

        test('should throw error for invalid validator in addValidationRule', () => {
            expect(() => {
                stateManager.addValidationRule('test.path', 'not a function');
            }).toThrow('StateManager: Validator must be a function');

            expect(() => {
                stateManager.addValidationRule('test.path', null);
            }).toThrow('StateManager: Validator must be a function');
        });

        test('should handle subscriber callback errors gracefully', () => {
            const errorCallback = jest.fn().mockImplementation(() => {
                throw new Error('Subscriber error');
            });
            
            stateManager.subscribe('test.path', errorCallback);
            
            // Should not throw, but should log error
            expect(() => {
                stateManager.setState('test.path', 'value');
            }).not.toThrow();
        });
    });

    describe('Debug Mode', () => {
        test('should enable debug mode', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            stateManager.setDebugMode(true);
            stateManager.setState('test.path', 'value');
            
            expect(consoleSpy).toHaveBeenCalledWith('StateManager: Set \'test.path\' =', 'value');
            
            consoleSpy.mockRestore();
        });

        test('should log subscription events in debug mode', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            stateManager.setDebugMode(true);
            stateManager.subscribe('test.path', () => {});
            
            expect(consoleSpy).toHaveBeenCalledWith('StateManager: Subscribed to \'test.path\'');
            
            consoleSpy.mockRestore();
        });
    });

    describe('Statistics', () => {
        test('should return accurate statistics', () => {
            stateManager.subscribe('path1', () => {});
            stateManager.subscribe('path2', () => {});
            stateManager.addValidationRule('test.path', () => true);
            stateManager.setState('test.value', 'value');
            stateManager.createCheckpoint('test');
            
            const stats = stateManager.getStats();
            
            expect(stats.subscriberCount).toBe(2);
            expect(stats.validationRuleCount).toBe(1);
            expect(stats.historySize).toBe(1);
            expect(stats.maxHistorySize).toBe(50);
            expect(stats.debugMode).toBe(false);
            expect(stats.stateSize).toBeGreaterThan(0);
            expect(stats.batchMode).toBe(false);
            expect(stats.rollbackStackSize).toBe(1);
            expect(stats.maxRollbackStack).toBe(20);
            expect(stats.diffCacheSize).toBe(0);
        });
    });

    describe('Integration with EventBus', () => {
        test('should work without EventBus', () => {
            const stateManagerWithoutEventBus = new StateManager();
            
            expect(() => {
                stateManagerWithoutEventBus.setState('test.path', 'value');
            }).not.toThrow();
        });

        test('should emit events through EventBus', async () => {
            const eventPromise = new Promise(resolve => {
                eventBus.subscribe('state:changed', resolve);
            });
            
            stateManager.setState('test.path', 'value');
            
            const eventData = await eventPromise;
            expect(eventData.path).toBe('test.path');
            expect(eventData.oldValue).toBeUndefined();
            expect(eventData.newValue).toBe('value');
            expect(eventData.timestamp).toBeGreaterThan(0);
        });
    });

    describe('Console Test Compatibility', () => {
        test('should work with console test example from task breakdown', () => {
            // Test state management
            stateManager.setState('user.name', 'Test User');
            
            const callback = jest.fn();
            stateManager.subscribe('user.name', callback);
            
            expect(stateManager.getState('user.name')).toBe('Test User');
            
            stateManager.setState('user.name', 'New Name');
            expect(callback).toHaveBeenCalledWith('New Name', 'Test User', 'user.name');
        });
    });
}); 