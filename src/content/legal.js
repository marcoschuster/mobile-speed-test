import { APP_NAME, LEGAL_EFFECTIVE_DATE, SUPPORT_MECHANISM, TEST_PROVIDERS } from '../config/appInfo';

export const LEGAL_SECTIONS = {
  privacy: {
    title: 'Privacy Policy',
    paragraphs: [
      `${APP_NAME} is a network speed testing app. This Privacy Policy is effective ${LEGAL_EFFECTIVE_DATE} and explains how ${APP_NAME} handles data when you run tests, view results, and manage the app.`,
      `${APP_NAME} does not require an account, does not sell personal information, and does not include advertising or analytics SDKs in this project.`,
      `When you run a speed test, your device makes network requests to third-party infrastructure providers used to power the test: ${TEST_PROVIDERS.join(', ')}. Those providers necessarily receive technical request data such as your IP address, user agent, timing, and network route information in order to respond to the test traffic.`,
      `${APP_NAME} stores your test history, settings, sound preferences, and privacy acknowledgement locally on your device. This data is used to show charts, summaries, and app behavior. It is not transmitted to the app publisher by this codebase.`,
      `History is kept on-device until you delete it or until the retention window you choose removes older results automatically. You can clear history and reset local settings from the Settings screen.`,
      `The app uses encrypted HTTPS and WSS connections for test traffic where supported by the provider endpoints. Local app data remains protected by the operating system sandbox and the security controls of your device.`,
      `For privacy questions or requests, ${SUPPORT_MECHANISM}`,
    ],
  },
  terms: {
    title: 'Terms of Use',
    paragraphs: [
      `${APP_NAME} is provided to help you measure network performance for personal or internal business use.`,
      `Speed test results are estimates, not guarantees of service quality, and may vary based on radio conditions, device limits, provider routing, congestion, and the remote test server used during a session.`,
      `You are responsible for any carrier, roaming, or bandwidth charges caused by running tests. Scheduled or repeated tests can use substantial data over time.`,
      `Do not use ${APP_NAME} in a way that harms networks, abuses third-party infrastructure, or violates the acceptable use rules of your internet or mobile provider.`,
      `The app is provided on an "as is" basis without warranties of uninterrupted availability, fitness for a particular purpose, or guaranteed accuracy.`,
    ],
  },
  data: {
    title: 'Data Practices',
    paragraphs: [
      `Collected directly by this app code: local test results, app settings, theme choice, sound preferences, and privacy acknowledgement. These remain on-device unless you choose to export your history.`,
      `Transmitted during tests: IP address, network timing, payload sizes, and connection metadata required by the selected test providers to execute download, upload, and latency measurements.`,
      `Not used here: account creation, advertising identifiers, contact lists, exact location permissions, camera, microphone, or background location.`,
      `Before publishing on Google Play, make sure the Data safety form matches the exact live behavior of the app, any SDKs you add later, and the privacy policy URL you host publicly.`,
    ],
  },
};
