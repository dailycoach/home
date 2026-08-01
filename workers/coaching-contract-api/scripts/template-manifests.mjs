import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const templateRoot = new URL('../../../coaching/contracts/templates/', import.meta.url);

const stableValue = value => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)])
    );
  }
  return value;
};

const load = async name => JSON.parse(await readFile(new URL(name, templateRoot), 'utf8'));
const common = await load('common.v1.json');
const output = {};

for (const type of ['life', 'business', 'career']) {
  const variant = await load(`${type}.v1.json`);
  const rawOverrides = variant.consentOverrides || [];
  const overrides = new Map(
    (Array.isArray(rawOverrides)
      ? rawOverrides
      : Object.entries(rawOverrides).map(([key, value]) => ({ key, ...value })))
      .map(item => [item.key, item])
  );
  const bundle = {
    templateId: `${common.templateId}+${variant.templateId}`,
    templateVersion: variant.templateVersion,
    contractType: type,
    locale: common.locale,
    title: variant.templateId,
    clauses: [...common.clauses, ...variant.clauses].sort((left, right) => left.order - right.order),
    optionalConsents: common.optionalConsents.map(definition => ({
      ...definition,
      ...(overrides.get(definition.key) || {}),
      key: definition.key,
      required: false,
      defaultAccepted: false
    })),
    legalReviewItems: [...(common.legalReviewItems || []), ...(variant.legalReviewItems || [])]
  };
  output[`${type}:${variant.templateVersion}`] = createHash('sha256')
    .update(JSON.stringify(stableValue(bundle)))
    .digest('hex');
}

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
