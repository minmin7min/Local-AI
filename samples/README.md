# Synthetic demonstration data only

Every person, email address, organization, policy, identifier, and record in this directory is fictional. Email addresses use the reserved `.invalid` domain. Never add real employee or customer information. Production use is prohibited until professional security, privacy, legal, cloud architecture, and penetration-testing reviews are complete.

The two tenants intentionally reuse fictional display names and employee suffixes so isolation tests cannot depend on globally distinctive labels.

Run `npm run db:seed` only against a disposable development database. The generated accounts all use the development-only password printed by the seed command. Never reuse it outside local synthetic demonstrations.

Included upload fixtures:

- `synthetic-employees.xlsx`: a visually verified employee import workbook with typed date cells and no formulas or active content.
- `synthetic-sick-leave-policy.docx`: a one-page fictional Word policy, rendered and visually inspected.
- `synthetic-sick-leave-policy.pdf`: a one-page fictional PDF policy, rendered, text-checked, and visually inspected.
