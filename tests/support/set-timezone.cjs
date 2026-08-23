/**
 * Pins the test process to a fixed non-UTC timezone.
 *
 * Constitution Principle IV forbids tests that depend on the machine's timezone. Pinning
 * to UTC would satisfy that letter while defeating its purpose: every "convert this
 * calendar date to a Date" bug is invisible at offset zero and appears a day early for
 * half the world. `America/Sao_Paulo` is UTC−3 with no daylight saving since 2019, so it
 * is stable, and any code that assumes local time is UTC fails here rather than in the
 * hands of a user.
 *
 * Node 16 and later re-read this on change, so setting it before the suite runs is
 * enough. Kept as CommonJS because Jest loads setup files synchronously.
 */
process.env.TZ = 'America/Sao_Paulo'
