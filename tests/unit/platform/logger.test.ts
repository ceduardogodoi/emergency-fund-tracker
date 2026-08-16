import { createLogger } from '@/platform/logging/logger'

describe('createLogger', () => {
  const sinks = () => ({
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })

  describe('when enabled', () => {
    it('forwards each level to its sink with the event name', () => {
      const sink = sinks()
      const logger = createLogger({ enabled: true, sink })

      logger.debug('goal.saved')
      logger.warn('import.retried')
      logger.error('storage.writeFailed')

      expect(sink.debug).toHaveBeenCalledWith('goal.saved', undefined)
      expect(sink.warn).toHaveBeenCalledWith('import.retried', undefined)
      expect(sink.error).toHaveBeenCalledWith('storage.writeFailed', undefined)
    })

    it('passes structured context through', () => {
      const sink = sinks()
      createLogger({ enabled: true, sink }).error('migration.failed', {
        fromVersion: 1,
        toVersion: 2,
        recoverable: false,
      })

      expect(sink.error).toHaveBeenCalledWith('migration.failed', {
        fromVersion: 1,
        toVersion: 2,
        recoverable: false,
      })
    })
  })

  describe('when disabled', () => {
    it('writes nothing at any level, so release builds stay silent', () => {
      const sink = sinks()
      const logger = createLogger({ enabled: false, sink })

      logger.debug('a')
      logger.warn('b')
      logger.error('c')

      expect(sink.debug).not.toHaveBeenCalled()
      expect(sink.warn).not.toHaveBeenCalled()
      expect(sink.error).not.toHaveBeenCalled()
    })
  })

  describe('nothing leaves the device', () => {
    it('exposes no transport, so SC-014 cannot be broken through the logger', () => {
      const logger = createLogger({ enabled: true, sink: sinks() })
      expect(Object.keys(logger).sort()).toEqual(['debug', 'error', 'warn'])
    })
  })
})
