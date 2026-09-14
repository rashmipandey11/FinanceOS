// Corporate networks (e.g. a TLS-inspecting proxy) re-sign HTTPS traffic with an
// internal root CA. Browsers trust it because they read the OS certificate store;
// Node ships its own CA bundle and doesn't, so outbound HTTPS calls (the Claude API)
// fail with UNABLE_TO_GET_ISSUER_CERT_LOCALLY. This bridges the Windows trusted-root
// store into Node's TLS stack so those calls succeed. Must be imported before any
// module that makes an HTTPS request.
if (process.platform === "win32") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("win-ca").inject("+");
  } catch (err) {
    console.warn("win-ca: could not inject Windows root certificates", err);
  }
}
