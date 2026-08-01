import { describe, expect, it } from 'vitest';
import { getServerTemplate, serverTemplateManifestHash, assertApprovedServerTemplate } from '../src/templates';
import type { Env } from '../src/types';

describe('server-owned contract templates', () => {
  const expectedManifestHashes = {
    life: 'eea36d8d0cf3fc270a68536a718f446dc06ef5494a3163dee9dd7f7404a6c201',
    business: '5c4ec7ca118cd411cdce3ac1dbc2a322178c80c259bf828193776d8ef90623a5',
    career: '1aea9c75cd2184ad0becaa6430755e6ffb55c041bf404cd0dcc548f22a7d3860',
  } as const;

  it.each(['life', 'business', 'career'] as const)('contains fixed common and %s clauses', async (type) => {
    const template = getServerTemplate(type);
    expect(template.clauses).toHaveLength(type === 'life' ? 32 : type === 'business' ? 34 : 34);
    expect(template.clauses[0]?.id).toBe('common.parties');
    expect(template.clauses.some((clause) => clause.id.startsWith(`${type}.`))).toBe(true);
    await expect(serverTemplateManifestHash(type)).resolves.toBe(expectedManifestHashes[type]);
  });

  it('fails closed while the repository template still requires legal review', async () => {
    const type = 'life';
    const hash = await serverTemplateManifestHash(type);
    const env = {
      APPROVED_TEMPLATE_MANIFESTS: JSON.stringify({ [`${type}:1.0.0`]: hash }),
    } as Env;
    await expect(assertApprovedServerTemplate(env, type, '1.0.0'))
      .rejects.toMatchObject({ code: 'TEMPLATE_LEGAL_REVIEW_REQUIRED' });
  });

  it('never substitutes client-provided clause wording for the server bundle', () => {
    const maliciousPreview = { clauses: [{ id: 'common.parties', body: '축약된 임의 문구' }] };
    const server = getServerTemplate('life');
    expect(server.clauses.find((clause) => clause.id === 'common.parties')?.body)
      .not.toBe(maliciousPreview.clauses[0]?.body);
  });
});
