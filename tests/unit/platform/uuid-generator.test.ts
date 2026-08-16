import { createIdGenerator } from '@/platform/id/uuid-generator'

/**
 * Two things are worth testing here and they are different.
 *
 * The adapter's own behavior — that it delegates to the injected source — is fully
 * covered below with a fake.
 *
 * The *contract* the port places on any source (RFC 4122 v4, never repeating) is asserted
 * against the platform's real generator. On device the source is `expo-crypto`'s
 * `randomUUID`, which cannot load in a Node test process; that binding is verified by the
 * on-device smoke flow rather than here, and this suite pins the shape it must satisfy.
 */
describe('createIdGenerator', () => {
  describe('delegation', () => {
    it('returns whatever the source produces', () => {
      const generator = createIdGenerator(() => 'fixed-id')
      expect(generator.uuid()).toBe('fixed-id')
    })

    it('calls the source once per id, so ids are not cached', () => {
      const source = jest.fn().mockReturnValueOnce('first').mockReturnValueOnce('second')
      const generator = createIdGenerator(source)

      expect(generator.uuid()).toBe('first')
      expect(generator.uuid()).toBe('second')
      expect(source).toHaveBeenCalledTimes(2)
    })
  })

  describe('the contract a source must satisfy', () => {
    const V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    const platformSource = () => globalThis.crypto.randomUUID()

    it('produces a well-formed UUID v4', () => {
      expect(createIdGenerator(platformSource).uuid()).toMatch(V4_PATTERN)
    })

    it('never repeats, since a collision would merge two different entries on import', () => {
      const generator = createIdGenerator(platformSource)
      const ids = new Set(Array.from({ length: 10_000 }, () => generator.uuid()))
      expect(ids.size).toBe(10_000)
    })
  })
})
