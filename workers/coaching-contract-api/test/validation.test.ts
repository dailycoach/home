import { describe, expect, it } from 'vitest';
import {
  HttpError,
  assertStatusTransition,
  canRecoverFinalization,
  parseConsentSelections,
  parseContractCreateInput,
  parseSignatureBody,
  shouldExpireIssuedContract,
} from '../src/validation';

function frontendDraft(type: 'life' | 'business' | 'career' = 'life'): Record<string, unknown> {
  const parties = [
    {
      role: 'coach', display_name: '김 코치', email: 'coach@example.com',
      required_signer: true,
    },
    {
      role: 'client', display_name: '고객 이름', email: 'client@example.com',
      required_signer: true,
    },
  ];
  if (type === 'business') {
    parties.push({
      role: 'sponsor', display_name: '조직 담당자', email: 'sponsor@example.com',
      required_signer: true,
    });
  }
  return {
    request_id: 'admin-request-id-0001',
    contract_type: type,
    template_version: '1.0.0',
    title: '테스트 코칭 계약서',
    adult_only_confirmed: true,
    parties,
    goal_summary: '고객이 합의한 구체적인 코칭 목표입니다.',
    session_count: 8,
    session_minutes: 60,
    delivery_method: 'online',
    start_date: '2026-08-10',
    expected_end_date: '2026-10-10',
    fee_amount: 800000,
    fee_currency: 'KRW',
    payment_terms: 'LEGAL_REVIEW_REQUIRED',
    cancellation_terms: 'LEGAL_REVIEW_REQUIRED',
    refund_terms: 'LEGAL_REVIEW_REQUIRED',
    confidentiality_scope: '당사자 외 공유하지 않습니다.',
    reporting_scope: type === 'business' ? 'attendance_and_contract_status' : 'none',
    sponsor_terms: type === 'business' ? { payer: 'sponsor', termination_authority: 'joint' } : null,
    record_management: {
      method: 'electronic', storage: 'encrypted', access: 'coach',
      retention: 'LEGAL_REVIEW_REQUIRED', deletion: 'secure deletion',
    },
    technology_terms: {
      session_recording: { enabled: false },
      ai_assisted_summary: { enabled: false },
      anonymized_case_use: { enabled: false },
      marketing_testimonial: { enabled: false },
    },
    termination_terms: '당사자의 전자 요청으로 종료합니다.',
    governing_law: 'LEGAL_REVIEW_REQUIRED',
    legal_review_status: 'LEGAL_REVIEW_REQUIRED',
  };
}

describe('API boundary normalization and validation', () => {
  it('accepts the frontend snake_case draft and adds server defaults', () => {
    const parsed = parseContractCreateInput(frontendDraft(), {
      contractNumber: 'DC-20260801-TEST000001',
      legalReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    });
    expect(parsed.contractType).toBe('life');
    expect(parsed.contractNumber).toBe('DC-20260801-TEST000001');
    expect(parsed.parties[0]?.displayName).toBe('김 코치');
    expect(parsed.parties[0]?.verificationMethod).toBe('invite_pin');
    expect(parsed.adultClientConfirmed).toBe(true);
    expect(parsed.canonicalDocument).toBeNull();
  });

  it('requires a required-signing sponsor for business contracts', () => {
    const draft = frontendDraft('business');
    const parties = draft.parties as Array<Record<string, unknown>>;
    if (parties[2]) parties[2].required_signer = false;
    expect(() => parseContractCreateInput(draft, { contractNumber: 'DC-BUSINESS-1' }))
      .toThrowError(HttpError);
  });

  it('normalizes consent payloads and keeps four independent decisions', () => {
    const consents = ['session_recording', 'ai_assisted_summary', 'anonymized_case_use', 'marketing_testimonial']
      .map((key) => ({
        consent_key: key,
        required: false,
        accepted: false,
        consent_text_version: `${key}-v1`,
        consent_text_hash: 'a'.repeat(64),
        options: {},
      }));
    const parsed = parseConsentSelections({ request_id: 'consent-request-0001', consents });
    expect(parsed).toHaveLength(4);
    expect(parsed.every((selection) => selection.accepted === false)).toBe(true);
    expect(parsed[0]?.submittedTextHash).toBe('a'.repeat(64));
  });

  it.each([
    ['all rejected', []],
    ['recording only', ['session_recording']],
    ['AI summary only', ['ai_assisted_summary']],
    ['anonymized case only', ['anonymized_case_use']],
    ['marketing testimonial only', ['marketing_testimonial']],
  ] as const)('accepts the independent consent combination: %s', (_label, acceptedKeys) => {
    const keys = [
      'session_recording',
      'ai_assisted_summary',
      'anonymized_case_use',
      'marketing_testimonial',
    ];
    const consents = keys.map((key) => {
      const accepted = acceptedKeys.some((acceptedKey) => acceptedKey === key);
      return {
        consent_key: key,
        required: false,
        accepted,
        consent_text_version: `${key}-v1`,
        consent_text_hash: 'c'.repeat(64),
        options: key === 'marketing_testimonial' && accepted ? {
          disclose_name: false,
          disclose_photo: false,
          disclose_organization: false,
          disclose_testimonial_text: true,
          publication_channels: ['dailycoaching_website'],
          publication_period: '1 year',
        } : {},
      };
    });
    const parsed = parseConsentSelections({ request_id: `combination-${_label.replaceAll(' ', '-')}`, consents });
    expect(parsed.filter((selection) => selection.accepted).map((selection) => selection.key))
      .toEqual([...acceptedKeys]);
  });

  it('normalizes the frontend signature payload with explicit confirmations', () => {
    expect(parseSignatureBody({
      request_id: 'signature-request-0001',
      signed_name: '고객 이름',
      electronic_signature_intent: true,
      confirmations: {
        contract_read: true,
        important_terms: true,
        electronic_document: true,
      },
      document_hash: 'b'.repeat(64),
      expected_version: 1,
    })).toMatchObject({
      signedName: '고객 이름',
      requestId: 'signature-request-0001',
      submittedDocumentHash: 'b'.repeat(64),
    });
  });
});

describe('contract state machine', () => {
  it.each([
    ['draft', 'ready'],
    ['ready', 'issued'],
    ['issued', 'viewed'],
    ['viewed', 'partially_signed'],
    ['partially_signed', 'fully_signed'],
    ['issued', 'expired'],
    ['issued', 'cancelled'],
    ['issued', 'superseded'],
    ['fully_signed', 'terminated'],
  ] as const)('allows %s -> %s', (from, to) => {
    expect(() => assertStatusTransition(from, to)).not.toThrow();
  });

  it.each([
    ['fully_signed', 'draft'],
    ['expired', 'fully_signed'],
    ['cancelled', 'fully_signed'],
    ['superseded', 'draft'],
    ['viewed', 'fully_signed'],
  ] as const)('blocks %s -> %s', (from, to) => {
    expect(() => assertStatusTransition(from, to)).toThrowError(HttpError);
  });

  it('lazily expires only an issued contract whose deadline passed', () => {
    const now = Date.parse('2026-08-01T12:00:00.000Z');
    expect(shouldExpireIssuedContract('issued', '2026-08-01T11:59:59.000Z', now)).toBe(true);
    expect(shouldExpireIssuedContract('issued', '2026-08-01T12:00:01.000Z', now)).toBe(false);
    expect(shouldExpireIssuedContract('viewed', '2026-08-01T11:59:59.000Z', now)).toBe(false);
  });

  it('offers finalization recovery only when every required signer has signed', () => {
    expect(canRecoverFinalization('partially_signed', 3, 3)).toBe(true);
    expect(canRecoverFinalization('partially_signed', 3, 2)).toBe(false);
    expect(canRecoverFinalization('fully_signed', 3, 3)).toBe(false);
  });
});
