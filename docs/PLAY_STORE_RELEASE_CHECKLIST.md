# Google Play Release Checklist

This repo now includes in-app legal surfaces plus hostable policy pages:

- `legal/privacy-policy.html`
- `legal/terms-of-use.html`
- `legal/data-practices.html`

Before submitting to Google Play, still complete these release-side tasks:

1. Host `legal/privacy-policy.html` on a public HTTPS URL and place that exact URL in the Play Console privacy policy field.
2. Review the text and replace any publisher/contact wording that should be specific to your business or support address.
3. Complete the `App content` declarations in Play Console, including privacy policy, ads declaration, target audience/content, and content rating.
4. Complete the `Data safety` form so it matches the current app behavior and any SDKs you add later.
5. Set your final Android application id, signing config, and release metadata in `app.json` / your build pipeline before the first production upload.
6. Verify the release build targets the current Play-required Android API level at release time.
7. Re-test export, disclosure, and deletion flows on a production Android build before upload.
