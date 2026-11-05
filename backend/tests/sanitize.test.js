import test from 'node:test'
import assert from 'node:assert/strict'
import { applicationSchema, assistantSchema, cvSchema, mongoIdParam, templateSchema } from '../utils/sanitize.js'
import { fetchJobPostingText, isPublicAddress, isSafeJobPostingUrl } from '../utils/jobPostingFetch.js'

const validApplication = { company: 'Esimerkki Oy', role: 'Kehittäjä', status: 'Lähetetty', link: 'https://example.com/jobs/1' }

test('accepts valid application data and normalizes optional fields', () => {
  const result = applicationSchema.safeParse(validApplication)
  assert.equal(result.success, true)
  assert.equal(result.data.place, '')
  assert.deepEqual(result.data.events, [])
})

test('rejects Mongo query operators and client supplied ownership fields', () => {
  assert.equal(applicationSchema.safeParse({ ...validApplication, $where: 'this.status' }).success, false)
  assert.equal(applicationSchema.safeParse({ ...validApplication, ownerId: 'attacker' }).success, false)
})

test('rejects executable URL schemes and URLs that exceed the limit', () => {
  assert.equal(applicationSchema.safeParse({ ...validApplication, link: 'javascript:alert(1)' }).success, false)
  assert.equal(applicationSchema.safeParse({ ...validApplication, link: `https://example.com/${'a'.repeat(2050)}` }).success, false)
})

test('rejects unexpected nested event properties', () => {
  assert.equal(applicationSchema.safeParse({ ...validApplication, events: [{ type: 'Lähetetty', date: '2026-11-05', $set: { ownerId: 'x' } }] }).success, false)
})

test('limits CV and template inputs and rejects extra fields', () => {
  assert.equal(cvSchema.safeParse({ name: 'CV', summary: 'x'.repeat(5001) }).success, false)
  assert.equal(templateSchema.safeParse({ name: 'Pohja', body: 'Teksti', ownerId: 'x' }).success, false)
})

test('AI route schema requires explicit consent and valid application id', () => {
  const context = { applicationId: '0123456789abcdef01234567', allowSuggestions: true }
  assert.equal(assistantSchema.safeParse({ message: 'Tee ehdotus', context }).success, true)
  assert.equal(assistantSchema.safeParse({ message: 'Tee ehdotus', context: { ...context, allowSuggestions: false } }).success, false)
  assert.equal(assistantSchema.safeParse({ message: 'Tee ehdotus', context: { ...context, applicationId: '$where' } }).success, false)
})

test('Mongo document ids must be 24 hexadecimal characters', () => {
  assert.equal(mongoIdParam('0123456789abcdef01234567'), true)
  assert.equal(mongoIdParam('$where'), false)
})

test('job posting fetch allows only HTTPS public web URLs', () => {
  assert.equal(isSafeJobPostingUrl('https://example.com/jobs/1'), true)
  assert.equal(isSafeJobPostingUrl('http://example.com/jobs/1'), false)
  assert.equal(isSafeJobPostingUrl('https://127.0.0.1/admin'), false)
  assert.equal(isSafeJobPostingUrl('https://[::1]/admin'), false)
  assert.equal(isSafeJobPostingUrl('https://169.254.169.254/latest/meta-data'), false)
  assert.equal(isSafeJobPostingUrl('https://localhost./admin'), false)
  assert.equal(isSafeJobPostingUrl('https://host.local./admin'), false)
  assert.equal(isSafeJobPostingUrl('https://168.63.129.16/latest/meta-data'), false)
  assert.equal(isSafeJobPostingUrl('https://user:pass@example.com/jobs/1'), false)
  assert.equal(isSafeJobPostingUrl('https://example.com:8443/jobs/1'), false)
})

test('SSRF filter rejects private, loopback, reserved, and cloud service addresses', async () => {
  for (const address of ['127.0.0.1', '10.0.0.2', '169.254.169.254', '::1', 'fc00::1', '2001:db8::1', '168.63.129.16']) {
    assert.equal(isPublicAddress(address), false, `${address} must not be fetched`)
  }
  assert.equal(isPublicAddress('1.1.1.1'), true)
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true)
  await assert.rejects(fetchJobPostingText('https://127.0.0.1/'), /julkinen/)
})
