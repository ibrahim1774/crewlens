import { sampleInvoiceHtml } from '@/lib/sample-invoice';

test('the sample invoice carries the company and job and a letter-size page', () => {
  const html = sampleInvoiceHtml('Maestro Roofing', 'Maestro House', new Date('2026-10-17T12:00:00'));
  expect(html).toContain('Maestro Roofing');
  expect(html).toContain('JOB · MAESTRO HOUSE');
  expect(html).toContain('OCT 17, 2026');
  expect(html).toContain('size:612pt 792pt');
  expect(html).toContain('$7,200.00');
});

test('names are escaped so a company called <b> cannot break the layout', () => {
  const html = sampleInvoiceHtml('<b>Bad & Co</b>', 'Job "A"');
  expect(html).not.toContain('<b>Bad');
  expect(html).toContain('&lt;b&gt;Bad &amp; Co&lt;/b&gt;');
});
